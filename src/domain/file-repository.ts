import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { SideChatError } from './errors.ts'
import type { SideChat, SideChatRepository } from './types.ts'

interface StoredDocument {
  version: 1
  notes: SideChat[]
}

function clone(note: SideChat): SideChat {
  return { ...note, anchor: { ...note.anchor } }
}

function isValidNote(value: unknown): value is SideChat {
  if (!value || typeof value !== 'object') return false
  const note = value as Record<string, unknown>
  const anchor = note.anchor
  return (
    typeof note.id === 'string' &&
    typeof note.parentSessionId === 'string' &&
    typeof note.clientRequestId === 'string' &&
    (note.childSessionId === null || typeof note.childSessionId === 'string') &&
    typeof note.title === 'string' &&
    ['light', 'fork'].includes(String(note.mode)) &&
    ['active', 'archived', 'promoted'].includes(String(note.status)) &&
    Number.isSafeInteger(note.revision) &&
    Number(note.revision) >= 1 &&
    typeof note.createdAt === 'string' &&
    typeof note.updatedAt === 'string' &&
    !!anchor && typeof anchor === 'object' &&
    typeof (anchor as Record<string, unknown>).messageId === 'string'
  )
}

/**
 * Single-process, serialized JSON repository. Replacement is atomic on one
 * filesystem, but concurrent processes must use an external lock.
 */
export class FileSideChatRepository implements SideChatRepository {
  private loaded = false
  private notes = new Map<string, SideChat>()
  private pending: Promise<void> = Promise.resolve()
  private readonly path: string

  constructor(path: string) {
    this.path = path
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation)
    this.pending = result.then(() => undefined, () => undefined)
    return result
  }

  private async load(): Promise<void> {
    if (this.loaded) return
    let text: string
    try {
      text = await readFile(this.path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.loaded = true
        return
      }
      throw error
    }
    const doc: unknown = JSON.parse(text)
    if (
      !doc ||
      typeof doc !== 'object' ||
      (doc as StoredDocument).version !== 1 ||
      !Array.isArray((doc as StoredDocument).notes)
    ) {
      throw new SideChatError('INVALID_STATE', 'side chat storage format is invalid')
    }
    const found = new Map<string, SideChat>()
    const requests = new Set<string>()
    for (const record of (doc as StoredDocument).notes) {
      if (!isValidNote(record)) {
        throw new SideChatError('INVALID_STATE', 'side chat storage contains invalid records')
      }
      const key = JSON.stringify([record.parentSessionId, record.clientRequestId])
      if (found.has(record.id) || requests.has(key)) {
        throw new SideChatError('INVALID_STATE', 'side chat storage contains duplicates')
      }
      found.set(record.id, clone(record))
      requests.add(key)
    }
    this.notes = found
    this.loaded = true
  }

  private async persist(): Promise<void> {
    const temp = this.path + '.' + randomUUID() + '.tmp'
    await mkdir(dirname(this.path), { recursive: true })
    try {
      const document: StoredDocument = { version: 1, notes: [...this.notes.values()] }
      await writeFile(temp, JSON.stringify(document, null, 2) + '\n', {
        mode: 0o600,
        flag: 'wx',
      })
      await rename(temp, this.path)
    } catch (error) {
      await unlink(temp).catch(() => undefined)
      throw error
    }
  }

  async insert(note: SideChat): Promise<SideChat> {
    return this.serial(async () => {
      await this.load()
      if (
        this.notes.has(note.id) ||
        [...this.notes.values()].some(
          n =>
            n.parentSessionId === note.parentSessionId &&
            n.clientRequestId === note.clientRequestId,
        )
      ) {
        throw new SideChatError('CONFLICT', 'note id or request already exists')
      }
      this.notes.set(note.id, clone(note))
      try {
        await this.persist()
      } catch (error) {
        this.notes.delete(note.id)
        throw error
      }
      return clone(note)
    })
  }

  async findById(id: string): Promise<SideChat | null> {
    return this.serial(async () => {
      await this.load()
      const n = this.notes.get(id)
      return n ? clone(n) : null
    })
  }

  async findByRequest(
    parentSessionId: string,
    clientRequestId: string,
  ): Promise<SideChat | null> {
    return this.serial(async () => {
      await this.load()
      const n = [...this.notes.values()].find(
        n => n.parentSessionId === parentSessionId && n.clientRequestId === clientRequestId,
      )
      return n ? clone(n) : null
    })
  }

  async listByParent(parentSessionId: string): Promise<SideChat[]> {
    return this.serial(async () => {
      await this.load()
      return [...this.notes.values()]
        .filter(n => n.parentSessionId === parentSessionId)
        .map(clone)
    })
  }

  async update(note: SideChat, expectedRevision: number): Promise<boolean> {
    return this.serial(async () => {
      await this.load()
      const old = this.notes.get(note.id)
      if (!old || old.revision !== expectedRevision) return false
      this.notes.set(note.id, clone(note))
      try {
        await this.persist()
      } catch (error) {
        this.notes.set(note.id, old)
        throw error
      }
      return true
    })
  }
}
