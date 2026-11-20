import { SideNoteError } from './errors.ts'
import type { SideNote, SideNoteRepository } from './types.ts'

function copy(note: SideNote): SideNote {
  return { ...note, anchor: { ...note.anchor } }
}

/** Test-only backing repository. Production Host must provide durable storage. */
export class MemorySideNoteRepository implements SideNoteRepository {
  private readonly notes = new Map<string, SideNote>()

  async insert(note: SideNote): Promise<SideNote> {
    if (this.notes.has(note.id)) throw new SideNoteError('CONFLICT', 'note id already exists')
    if (
      Array.from(this.notes.values()).some(
        current =>
          current.parentSessionId === note.parentSessionId &&
          current.clientRequestId === note.clientRequestId,
      )
    ) {
      throw new SideNoteError('CONFLICT', 'request already exists')
    }
    this.notes.set(note.id, copy(note))
    return copy(note)
  }

  async findById(id: string): Promise<SideNote | null> {
    const note = this.notes.get(id)
    return note ? copy(note) : null
  }

  async findByRequest(parentSessionId: string, clientRequestId: string): Promise<SideNote | null> {
    const note = Array.from(this.notes.values()).find(
      current =>
        current.parentSessionId === parentSessionId &&
        current.clientRequestId === clientRequestId,
    )
    return note ? copy(note) : null
  }

  async listByParent(parentSessionId: string): Promise<SideNote[]> {
    return Array.from(this.notes.values())
      .filter(note => note.parentSessionId === parentSessionId)
      .map(copy)
  }

  async update(note: SideNote, expectedRevision: number): Promise<boolean> {
    const current = this.notes.get(note.id)
    if (!current || current.revision !== expectedRevision) return false
    this.notes.set(note.id, copy(note))
    return true
  }
}
