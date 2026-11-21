import { SideChatError } from '../domain/errors.ts'
import type { SideChat } from '../domain/types.ts'
import type { SideSessionPort } from './coordinator.ts'

export interface ObservedEvent {
  readonly seq: number
  readonly type: string
  readonly data: unknown
}
export interface ObservedSession {
  readonly header: { readonly id: string; readonly cwd?: string }
  readonly events: readonly ObservedEvent[]
  readonly persistedEventCount?: number
  readonly inheritedEventCount?: number
  release(): void
}
export interface SideAgentHandle {
  readonly id: string
  followup(text: string): void
  cancel(): void
  whenIdle(): Promise<void>
  dispose(): Promise<void>
}
export interface CreateSideAgent {
  sessionId: string
  cwd?: string
  /** SideChat context supplied as durable, child-local next-step input. */
  initialContext?: string
  /** Fork: exact parent log cut with synthetic closers created by DSH. */
  fork?: {
    parentSessionId: string
    eventCount: number
    persistedCount: number
    events: readonly ObservedEvent[]
  }
}
/**
 * Narrow bridge to verified DSH public capabilities. The production bridge
 * uses ctx.agents.create/resume, ctx.sessionQuery.observeSession,
 * buildForkSeed and ctx.workspaceRegistry archive/unarchive.
 */
export interface DshRuntimeBridge {
  observe(sessionId: string): Promise<ObservedSession>
  create(options: CreateSideAgent): Promise<SideAgentHandle>
  resume(sessionId: string): Promise<SideAgentHandle>
  archive(sessionId: string): Promise<void>
  unarchive(sessionId: string): Promise<void>
  /** True only for DSH's exact not-found classification. */
  isNotFound(error: unknown): boolean
}

function messageId(event: ObservedEvent): string | undefined {
  if (!event.data || typeof event.data !== 'object') return undefined
  const data = event.data as Record<string, unknown>
  if (event.type === 'user/message') {
    return typeof data.id === 'string' ? data.id : undefined
  }
  if (event.type === 'assistant/message') {
    const message = data.message
    if (message && typeof message === 'object' && 'id' in message) {
      const id = (message as { id?: unknown }).id
      return typeof id === 'string' ? id : undefined
    }
  }
  return undefined
}

function noteSessionId(noteId: string): string {
  // The note ID is created by the Host. A deterministic ID makes a creation
  // that succeeded before metadata binding retryable after a process restart.
  return 'session-sidechat-' + noteId
}

function sourceContext(note: SideChat): string {
  const selected = note.anchor.selectedText?.trim()
  return [
    'SideChat: This is an independent side conversation.',
    'The parent conversation must not be modified or continued.',
    'Answer follow-up questions using only the available context.',
    'Topic: ' + note.title,
    ...(selected ? ['Source quotation:\n' + selected] : []),
  ].join('\n\n')
}

function forkBoundary(events: readonly ObservedEvent[], note: SideChat): number {
  const at = events.findIndex(event =>
    messageId(event) === note.anchor.messageId &&
    (note.anchor.eventSeq === undefined || event.seq === note.anchor.eventSeq),
  )
  if (at < 0) {
    throw new SideChatError('INVALID_INPUT', 'anchor message does not exist in parent session')
  }
  const completed = events.slice(at).find(event => event.type === 'turn/end')
  if (!completed) {
    throw new SideChatError('INVALID_STATE', 'anchor turn has not completed')
  }
  if (!Number.isSafeInteger(completed.seq) || completed.seq < 0) {
    throw new SideChatError('INVALID_STATE', 'invalid source event boundary')
  }
  return completed.seq
}

/**
 * DSH session lifecycle with fail-closed tool policy provided by the bridge:
 *
 * - A child has a deterministic, retryable persisted identity.
 * - Archiving hides the Session from the left list when idle.
 * - A followup unarchives before Agent admission; only rearchives after idle.
 * - Promotion unarchives the same Session, keeping its history unchanged.
 *
 * A browser must never call this class directly; use an authenticated Host API
 * and SideChatCoordinator authorization.
 */
export class DshSideSessionAdapter implements SideSessionPort {
  private readonly handles = new Map<string, SideAgentHandle>()
  private readonly children = new Set<string>()
  private readonly promoted = new Set<string>()
  private readonly flights = new Map<string, Promise<unknown>>()
  private readonly pending = new Map<string, number>()
  private readonly settlement = new Set<Promise<void>>()
  private closed = false

  private readonly runtime: DshRuntimeBridge

  constructor(runtime: DshRuntimeBridge) {
    this.runtime = runtime
  }

  async ensure(note: SideChat, policy: { readOnly: true }): Promise<{ sessionId: string }> {
    if (policy.readOnly !== true) throw new SideChatError('INVALID_STATE', 'side agent must be read-only')
    const sessionId = noteSessionId(note.id)
    return this.once('init:' + sessionId, async () => {
      this.assertOpen()
      if (note.childSessionId && note.childSessionId !== sessionId) {
        throw new SideChatError('CONFLICT', 'note is bound to an unexpected Session')
      }
      // If a retry follows a successful create, a live handle or a durable
      // observation recovers the *same* child instead of making an orphan.
      if (this.children.has(sessionId)) return { sessionId }
      if (this.handles.has(sessionId)) {
        this.children.add(sessionId)
        return { sessionId }
      }
      let persisted = false
      try {
        const existing = await this.runtime.observe(sessionId)
        try {
          if (existing.header.id !== sessionId) {
            throw new SideChatError('CONFLICT', 'Session identity mismatch')
          }
          persisted = true
        } finally {
          existing.release()
        }
      } catch (error) {
        if (!this.runtime.isNotFound(error)) throw error
      }
      if (persisted) {
        // Archived Sessions cannot be resumed while the DSH archived gate is active.
        // Open the stored child transiently, then hide it again after hydration.
        await this.runtime.unarchive(sessionId)
        try {
          const handle = await this.runtime.resume(sessionId)
          this.handles.set(sessionId, handle)
          this.children.add(sessionId)
        } finally {
          await this.runtime.archive(sessionId)
        }
        return { sessionId }
      }

      const parent = await this.runtime.observe(note.parentSessionId)
      let options: CreateSideAgent
      try {
        const boundary = forkBoundary(parent.events, note)
        options = {
          sessionId,
          ...(parent.header.cwd ? { cwd: parent.header.cwd } : {}),
          ...(note.mode === 'fork'
            ? {
                fork: {
                  parentSessionId: note.parentSessionId,
                  eventCount: boundary + 1,
                  persistedCount: Math.min(boundary + 1, parent.persistedEventCount ?? boundary + 1),
                  events: parent.events.slice(0, boundary + 1),
                },
              }
            : { initialContext: sourceContext(note) }),
        }
      } finally {
        parent.release()
      }
      const handle = await this.runtime.create(options)
      this.handles.set(sessionId, handle)
      // Crash after create but before archive is reconciled through the
      // persisted deterministic ID on next ensure().
      await this.runtime.archive(sessionId)
      this.children.add(sessionId)
      return { sessionId }
    })
  }

  async followup(sessionId: string, text: string): Promise<void> {
    this.assertKnown(sessionId)
    await this.serialize('admit:' + sessionId, async () => {
      const handle = await this.live(sessionId)
      if (this.pending.get(sessionId) === undefined) {
        await this.runtime.unarchive(sessionId)
      }
      this.pending.set(sessionId, (this.pending.get(sessionId) ?? 0) + 1)
      try {
        handle.followup(text)
      } catch (error) {
        const remaining = (this.pending.get(sessionId) ?? 1) - 1
        if (remaining > 0) this.pending.set(sessionId, remaining)
        else {
          this.pending.delete(sessionId)
          if (!this.promoted.has(sessionId)) await this.runtime.archive(sessionId)
        }
        throw error
      }
      const task = handle.whenIdle().then(
        () => this.settleOne(sessionId),
        () => this.settleOne(sessionId),
      )
      this.settlement.add(task)
      void task.finally(() => this.settlement.delete(task)).catch(() => undefined)
    })
  }

  async cancel(sessionId: string): Promise<void> {
    this.assertKnown(sessionId)
    const handle = await this.live(sessionId)
    handle.cancel()
  }

  async promote(note: SideChat): Promise<{ sessionId: string }> {
    const sessionId = noteSessionId(note.id)
    this.assertKnown(sessionId)
    return this.once('promote:' + sessionId, async () => {
      const handle = await this.live(sessionId)
      await handle.whenIdle()
      await this.serialize('admit:' + sessionId, async () => {
        // The Host metadata commit can fail: repeating promotion is harmless.
        await this.runtime.unarchive(sessionId)
        this.promoted.add(sessionId)
      })
      return { sessionId }
    })
  }

  async dispose(): Promise<void> {
    if (this.closed) return
    this.closed = true
    for (const handle of this.handles.values()) {
      try { handle.cancel() } catch { /* the runtime will dispose the handle */ }
    }
    await Promise.allSettled([...this.settlement])
    await Promise.allSettled([...this.handles.values()].map(h => h.dispose()))
    this.handles.clear()
    this.children.clear()
  }

  private async live(sessionId: string): Promise<SideAgentHandle> {
    const handle = this.handles.get(sessionId)
    if (handle) return handle
    return this.once('resume:' + sessionId, async () => {
      const existing = this.handles.get(sessionId)
      if (existing) return existing
      const resumed = await this.runtime.resume(sessionId)
      this.handles.set(sessionId, resumed)
      return resumed
    })
  }

  private async settleOne(sessionId: string): Promise<void> {
    await this.serialize('admit:' + sessionId, async () => {
      const remaining = (this.pending.get(sessionId) ?? 1) - 1
      if (remaining > 0) {
        this.pending.set(sessionId, remaining)
        return
      }
      this.pending.delete(sessionId)
      if (!this.promoted.has(sessionId)) await this.runtime.archive(sessionId)
    })
  }

  private assertKnown(sessionId: string): void {
    this.assertOpen()
    if (!this.children.has(sessionId) && ![...this.handles.keys()].includes(sessionId)) {
      // New plugin instances can recover a bound Session only after authorized
      // note membership has been checked and explicitly hydrated.
      throw new SideChatError('NOT_FOUND', 'side Session is not owned by this plugin')
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new SideChatError('INVALID_STATE', 'side Session adapter is disposed')
  }

  private serialize<T>(key: string, work: () => Promise<T>): Promise<T> {
    const prior = this.flights.get(key)
    const task = (prior ?? Promise.resolve()).catch(() => undefined).then(work).finally(() => {
      if (this.flights.get(key) === task) this.flights.delete(key)
    })
    this.flights.set(key, task)
    return task
  }

  private once<T>(key: string, work: () => Promise<T>): Promise<T> {
    const existing = this.flights.get(key)
    if (existing) return existing as Promise<T>
    const task = work().finally(() => {
      if (this.flights.get(key) === task) this.flights.delete(key)
    })
    this.flights.set(key, task)
    return task
  }
}
