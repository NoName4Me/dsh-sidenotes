import { SideNoteError } from '../domain/errors.ts'
import { SideNoteService } from '../domain/service.ts'
import { normalizeCreate, requiredId } from '../domain/validation.ts'
import type { CreateSideNoteInput, SideNote, SideNoteAnchor } from '../domain/types.ts'

/** Every exposed Host operation must be checked against the authenticated caller. */
export interface SideNoteAccess {
  assertParentAccess(parentSessionId: string): Promise<void>
  assertAnchorBelongsToParent(parentSessionId: string, anchor: SideNoteAnchor): Promise<void>
}

/**
 * Implemented by a version-specific DSH Agent/Session adapter, not by a bare
 * sessions.fork() call. ensure() must be retry-safe for a given note.id; if a
 * Session was created before metadata binding failed, it must recover that
 * same identity rather than creating a second child.
 *
 * The adapter is responsible for enforcing read-only at the Host tool layer.
 */
export interface SideSessionPort {
  ensure(note: SideNote, policy: { readOnly: true }): Promise<{ sessionId: string }>
  followup(sessionId: string, text: string): Promise<void>
  cancel(sessionId: string): Promise<void>
  /** Idempotent for note.id; do not change visibility until Agent is stable. */
  promote(note: SideNote): Promise<{ sessionId: string }>
}

const MAX_FOLLOWUP_LENGTH = 32_000

/**
 * Authorized, idempotent orchestration above the tested domain service.
 * In-flight coalescing is process-local; cross-process safety depends on the
 * repository's compare-and-swap and the adapter's deterministic ensure().
 */
export class SideNoteCoordinator {
  private readonly inFlight = new Map<string, Promise<unknown>>()
  private readonly notes: SideNoteService
  private readonly access: SideNoteAccess
  private readonly sessions: SideSessionPort

  constructor(
    notes: SideNoteService,
    access: SideNoteAccess,
    sessions: SideSessionPort,
  ) {
    this.notes = notes
    this.access = access
    this.sessions = sessions
  }

  async create(input: CreateSideNoteInput): Promise<SideNote> {
    const normalized = normalizeCreate(input)
    await this.access.assertParentAccess(normalized.parentSessionId)
    await this.access.assertAnchorBelongsToParent(normalized.parentSessionId, normalized.anchor)

    const note = await this.notes.create(normalized)
    // An idempotency key cannot silently refer to a *different* selected text.
    if (
      note.mode !== normalized.mode ||
      note.anchor.messageId !== normalized.anchor.messageId ||
      note.anchor.eventSeq !== normalized.anchor.eventSeq ||
      note.anchor.selectedText !== normalized.anchor.selectedText ||
      note.title !== normalized.title
    ) {
      throw new SideNoteError('CONFLICT', 'request id was reused with different content')
    }
    return this.ensureBound(normalized.parentSessionId, note.id)
  }

  async get(parentSessionId: string, noteId: string): Promise<SideNote> {
    await this.authorize(parentSessionId)
    return this.notes.get(parentSessionId, noteId)
  }

  async list(parentSessionId: string, includeArchived = false): Promise<SideNote[]> {
    await this.authorize(parentSessionId)
    return this.notes.list(parentSessionId, includeArchived)
  }

  async followup(parentSessionId: string, noteId: string, text: string): Promise<void> {
    await this.authorize(parentSessionId)
    const note = await this.notes.get(parentSessionId, noteId)
    if (note.status !== 'active') {
      throw new SideNoteError('INVALID_STATE', 'only active side notes accept followups')
    }
    if (
      typeof text !== 'string' ||
      !text.trim() ||
      text.length > MAX_FOLLOWUP_LENGTH ||
      text.includes('\0')
    ) {
      throw new SideNoteError('INVALID_INPUT', 'invalid followup text')
    }
    if (!note.childSessionId) {
      throw new SideNoteError('INVALID_STATE', 'side note is not attached to a DSH session')
    }
    await this.hydrate(note)
    await this.sessions.followup(note.childSessionId, text)
  }

  async cancel(parentSessionId: string, noteId: string): Promise<void> {
    await this.authorize(parentSessionId)
    const note = await this.notes.get(parentSessionId, noteId)
    if (!note.childSessionId) return
    await this.hydrate(note)
    await this.sessions.cancel(note.childSessionId)
  }

  async archive(parentSessionId: string, noteId: string): Promise<SideNote> {
    await this.authorize(parentSessionId)
    return this.notes.archive(parentSessionId, noteId)
  }

  async restore(parentSessionId: string, noteId: string): Promise<SideNote> {
    await this.authorize(parentSessionId)
    return this.notes.restore(parentSessionId, noteId)
  }

  async promote(parentSessionId: string, noteId: string): Promise<SideNote> {
    await this.authorize(parentSessionId)
    return this.singleFlight('promote:' + noteId, async () => {
      let note = await this.notes.get(parentSessionId, noteId)
      if (note.status === 'promoted') return note
      note = await this.ensureBound(parentSessionId, noteId)
      await this.hydrate(note)
      // External promotion can succeed before metadata commit; the port's
      // idempotence contract makes recovery safe on a repeated request.
      const result = await this.sessions.promote(note)
      return this.notes.promote(parentSessionId, noteId, requiredId(result.sessionId, 'sessionId'))
    })
  }

  private async ensureBound(parentSessionId: string, noteId: string): Promise<SideNote> {
    return this.singleFlight('ensure:' + noteId, async () => {
      const existing = await this.notes.get(parentSessionId, noteId)
      if (existing.childSessionId) return existing
      const result = await this.sessions.ensure(existing, { readOnly: true })
      return this.notes.bindSession(
        parentSessionId,
        noteId,
        requiredId(result.sessionId, 'sessionId'),
      )
    })
  }

  /** Rehydrate the Agent after Host restart; binding metadata alone is not a live Agent. */
  private async hydrate(note: SideNote): Promise<void> {
    if (!note.childSessionId) {
      throw new SideNoteError('INVALID_STATE', 'side note has no backing Session')
    }
    const resumed = await this.sessions.ensure(note, { readOnly: true })
    if (resumed.sessionId !== note.childSessionId) {
      throw new SideNoteError('CONFLICT', 'resumed child does not match persisted note binding')
    }
  }

  private async authorize(parentSessionId: string): Promise<void> {
    await this.access.assertParentAccess(requiredId(parentSessionId, 'parentSessionId'))
  }

  private singleFlight<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key)
    if (existing) return existing as Promise<T>
    const ongoing = operation().finally(() => {
      if (this.inFlight.get(key) === ongoing) this.inFlight.delete(key)
    })
    this.inFlight.set(key, ongoing)
    return ongoing
  }
}
