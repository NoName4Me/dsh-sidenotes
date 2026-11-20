import type { Context } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/**
 * Deliberately does not send the main agent a message. Quote insertion uses
 * Harness's native editor operation and keeps any existing draft intact.
 */
export function createBringBack(ctx: Context) {
  return (parentSessionId: string, title: string, text: string): boolean => {
    const sessions = ctx.get('sessions') as ISessions | undefined
    const conversation = ctx.get('conversation') as IConversation | undefined
    if (!sessions || !conversation || text.trim().length === 0) return false
    const binding = sessions.binding(parentSessionId as SessionId)
    if (!binding) return false
    const input = conversation.input.for(binding.ctx)
    const quote = [
      'SideNotes · ' + title.slice(0, 120),
      text.slice(0, 16_000),
    ].join('\n\n')
    return input.insertQuote(quote)
  }
}
