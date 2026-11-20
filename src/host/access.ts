import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-query'
import { SideNoteError } from '../domain/errors.ts'
import type { SideNoteAnchor } from '../domain/types.ts'
import type { SideNoteAccess } from './coordinator.ts'

function sourceMessageId(event: { type: string; data: unknown }): string | undefined {
  if (!event.data || typeof event.data !== 'object') return undefined
  const data = event.data as Record<string, unknown>
  if (event.type === 'user/message') return typeof data.id === 'string' ? data.id : undefined
  if (event.type !== 'assistant/message' || !data.message || typeof data.message !== 'object') return undefined
  const message = data.message as Record<string, unknown>
  return typeof message.id === 'string' ? message.id : undefined
}

/** Parent evidence is read from the DSH Session log, not from the browser. */
export class DshSideNoteAccess implements SideNoteAccess {
  private readonly ctx: Context
  constructor(ctx: Context) { this.ctx = ctx }

  async assertParentAccess(parentSessionId: string): Promise<void> {
    const observed = await this.ctx.sessionQuery.observeSession(SessionId(parentSessionId), { projectionMode: 'none' })
    observed[Symbol.dispose]()
  }

  async assertAnchorBelongsToParent(parentSessionId: string, anchor: SideNoteAnchor): Promise<void> {
    const observed = await this.ctx.sessionQuery.observeSession(SessionId(parentSessionId), { projectionMode: 'none' })
    try {
      if (!observed.events.some(event =>
        sourceMessageId(event) === anchor.messageId &&
        (anchor.eventSeq === undefined || event.seq === anchor.eventSeq),
      )) {
        throw new SideNoteError('INVALID_INPUT', 'anchor message does not belong to the requested Session')
      }
    } finally {
      observed[Symbol.dispose]()
    }
  }
}
