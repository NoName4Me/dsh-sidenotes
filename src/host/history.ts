import type { HistoryReader, SideNoteHistory, HistoryItem } from './rpc.ts'
import type { SideNote } from '../domain/types.ts'
import type { ObservedSession, ObservedEvent } from './dsh-session-adapter.ts'
import { SideNoteError } from '../domain/errors.ts'

export interface HistoryRuntime {
  observe(sessionId: string): Promise<ObservedSession>
  isRunning(sessionId: string): boolean
}

function messageOf(event: ObservedEvent): {
  id: string
  content: readonly unknown[]
  source?: { kind?: string }
} | undefined {
  const value = event.data
  if (!value || typeof value !== 'object') return undefined
  const data = value as Record<string, unknown>
  const record = event.type === 'user/message' ? data : data.message
  if (!record || typeof record !== 'object') return undefined
  const message = record as Record<string, unknown>
  if (typeof message.id !== 'string' || !Array.isArray(message.content)) return undefined
  return {
    id: message.id,
    content: message.content,
    ...(message.source && typeof message.source === 'object'
      ? { source: message.source as { kind?: string } } : {}),
  }
}

function extractText(content: readonly unknown[]): string {
  const text = content.flatMap(block => {
    if (!block || typeof block !== 'object') return []
    const value = block as { type?: unknown; text?: unknown }
    return value.type === 'text' && typeof value.text === 'string' ? [value.text] : []
  }).join('\n')
  return text.slice(0, 16_000)
}

export class DshHistoryReader implements HistoryReader {
  private readonly runtime: HistoryRuntime

  constructor(runtime: HistoryRuntime) {
    this.runtime = runtime
  }

  async read(note: SideNote): Promise<SideNoteHistory> {
    if (!note.childSessionId) {
      throw new SideNoteError('INVALID_STATE', 'note has no child Session')
    }
    const session = await this.runtime.observe(note.childSessionId)
    try {
      const items: HistoryItem[] = []
      for (const event of session.events) {
        // Forks inherit the main transcript for model context, not for
        // duplication in the visible SideNotes conversation.
        if (event.seq < (session.inheritedEventCount ?? 0)) continue
        if (event.type !== 'user/message' && event.type !== 'assistant/message') continue
        const message = messageOf(event)
        if (!message) continue
        if (event.type === 'user/message' && message.source?.kind !== 'user') continue
        const text = extractText(message.content)
        if (text.length === 0) continue
        items.push({
          messageId: message.id,
          role: event.type === 'user/message' ? 'user' : 'assistant',
          text,
          seq: event.seq,
        })
      }
      return {
        childSessionId: note.childSessionId,
        items: items.slice(-50),
        busy: this.runtime.isRunning(note.childSessionId),
      }
    } finally {
      session.release()
    }
  }
}
