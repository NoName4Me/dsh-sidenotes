import { SideChatError } from './errors.ts'
import { normalizeCreate, requiredId } from './validation.ts'
import type { CreateSideChatInput, SideChat, SideChatRepository } from './types.ts'

export interface SideChatServiceOptions {
  idFactory?: () => string
  now?: () => Date
}

/** Owns metadata only; binding a real DSH Session is a separate Host operation. */
export class SideChatService {
  private readonly idFactory: () => string
  private readonly now: () => Date
  private readonly repository: SideChatRepository

  constructor(repository: SideChatRepository, options: SideChatServiceOptions = {}) {
    this.repository = repository
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID())
    this.now = options.now ?? (() => new Date())
  }

  async create(input: CreateSideChatInput): Promise<SideChat> {
    const normalized = normalizeCreate(input)
    const existing = await this.repository.findByRequest(
      normalized.parentSessionId,
      normalized.clientRequestId,
    )
    if (existing) return existing
    const timestamp = this.now().toISOString()
    const note: SideChat = {
      id: this.idFactory(),
      ...normalized,
      childSessionId: null,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 1,
    }
    try {
      return await this.repository.insert(note)
    } catch (error) {
      // A concurrent request using the same idempotency key should reuse the created record.
      const duplicate = await this.repository.findByRequest(
        normalized.parentSessionId,
        normalized.clientRequestId,
      )
      if (duplicate) return duplicate
      throw error
    }
  }

  async get(parentSessionId: string, noteId: string): Promise<SideChat> {
    requiredId(parentSessionId, 'parentSessionId')
    requiredId(noteId, 'noteId')
    const note = await this.repository.findById(noteId)
    if (!note || note.parentSessionId !== parentSessionId) {
      throw new SideChatError('NOT_FOUND', 'side chat not found for parent session')
    }
    return note
  }

  async list(parentSessionId: string, includeArchived = false): Promise<SideChat[]> {
    requiredId(parentSessionId, 'parentSessionId')
    const items = await this.repository.listByParent(parentSessionId)
    return items
      .filter(note => includeArchived || note.status !== 'archived')
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
      )
  }

  async bindSession(
    parentSessionId: string,
    noteId: string,
    childSessionId: string,
  ): Promise<SideChat> {
    requiredId(childSessionId, 'childSessionId')
    return this.transition(parentSessionId, noteId, note => {
      if (note.status === 'promoted')
        throw new SideChatError('INVALID_STATE', 'promoted side chat cannot be rebound')
      if (note.childSessionId === childSessionId) return null
      if (note.childSessionId !== null)
        throw new SideChatError('CONFLICT', 'child session is already bound')
      return { ...note, childSessionId }
    })
  }

  async archive(parentSessionId: string, noteId: string): Promise<SideChat> {
    return this.transition(parentSessionId, noteId, note => {
      if (note.status === 'promoted')
        throw new SideChatError('INVALID_STATE', 'promoted side chat cannot be archived')
      return note.status === 'archived' ? null : { ...note, status: 'archived' }
    })
  }

  async restore(parentSessionId: string, noteId: string): Promise<SideChat> {
    return this.transition(parentSessionId, noteId, note => {
      if (note.status === 'promoted')
        throw new SideChatError('INVALID_STATE', 'promoted side chat cannot be restored')
      return note.status === 'active' ? null : { ...note, status: 'active' }
    })
  }

  async promote(
    parentSessionId: string,
    noteId: string,
    promotedSessionId: string,
  ): Promise<SideChat> {
    requiredId(promotedSessionId, 'promotedSessionId')
    return this.transition(parentSessionId, noteId, note => {
      if (note.status === 'promoted') {
        if (note.promotedSessionId === promotedSessionId) return null
        throw new SideChatError('CONFLICT', 'side chat already promoted to another session')
      }
      if (!note.childSessionId)
        throw new SideChatError('INVALID_STATE', 'side chat has no backing DSH session')
      return { ...note, status: 'promoted', promotedSessionId }
    })
  }

  private async transition(
    parentSessionId: string,
    noteId: string,
    fn: (note: SideChat) => SideChat | null,
  ): Promise<SideChat> {
    // Compare-and-swap prevents silently overwriting concurrent state changes.
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await this.get(parentSessionId, noteId)
      const next = fn(current)
      if (!next) return current
      const candidate: SideChat = {
        ...next,
        revision: current.revision + 1,
        updatedAt: this.now().toISOString(),
      }
      if (await this.repository.update(candidate, current.revision)) return candidate
    }
    throw new SideChatError('CONFLICT', 'side chat was modified concurrently; retry')
  }
}
