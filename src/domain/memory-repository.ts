import { SideChatError } from './errors.ts'
import type { SideChat, SideChatRepository } from './types.ts'

function copy(note: SideChat): SideChat {
  return { ...note, anchor: { ...note.anchor } }
}

/** Test-only backing repository. Production Host must provide durable storage. */
export class MemorySideChatRepository implements SideChatRepository {
  private readonly notes = new Map<string, SideChat>()

  async insert(note: SideChat): Promise<SideChat> {
    if (this.notes.has(note.id)) throw new SideChatError('CONFLICT', 'note id already exists')
    if (
      Array.from(this.notes.values()).some(
        current =>
          current.parentSessionId === note.parentSessionId &&
          current.clientRequestId === note.clientRequestId,
      )
    ) {
      throw new SideChatError('CONFLICT', 'request already exists')
    }
    this.notes.set(note.id, copy(note))
    return copy(note)
  }

  async findById(id: string): Promise<SideChat | null> {
    const note = this.notes.get(id)
    return note ? copy(note) : null
  }

  async findByRequest(parentSessionId: string, clientRequestId: string): Promise<SideChat | null> {
    const note = Array.from(this.notes.values()).find(
      current =>
        current.parentSessionId === parentSessionId &&
        current.clientRequestId === clientRequestId,
    )
    return note ? copy(note) : null
  }

  async listByParent(parentSessionId: string): Promise<SideChat[]> {
    return Array.from(this.notes.values())
      .filter(note => note.parentSessionId === parentSessionId)
      .map(copy)
  }

  async update(note: SideChat, expectedRevision: number): Promise<boolean> {
    const current = this.notes.get(note.id)
    if (!current || current.revision !== expectedRevision) return false
    this.notes.set(note.id, copy(note))
    return true
  }
}
