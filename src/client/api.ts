import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { SideChat } from '../domain/types.ts'
import type { SideChatHistory } from '../host/rpc.ts'
import { SIDECHAT_CHANNEL } from '../shared/channel.ts'

export interface SideChatApi {
  list(parentSessionId: string): Promise<SideChat[]>
  create(input: {
    parentSessionId: string
    clientRequestId: string
    anchor: { messageId: string; selectedText?: string }
    title?: string
    mode?: 'light' | 'fork'
  }): Promise<SideChat>
  history(parentSessionId: string, noteId: string): Promise<SideChatHistory>
  followup(parentSessionId: string, noteId: string, text: string): Promise<void>
  cancel(parentSessionId: string, noteId: string): Promise<void>
  archive(parentSessionId: string, noteId: string): Promise<SideChat>
  restore(parentSessionId: string, noteId: string): Promise<SideChat>
  promote(parentSessionId: string, noteId: string): Promise<SideChat>
}

export function createSideChatApi(ctx: Context): SideChatApi {
  const connection = ctx.get('connection') as ConnectionHandle
  async function invoke<T>(operation: string, payload: object): Promise<T> {
    const reply = await connection.rpc.call(SIDECHAT_CHANNEL, operation, payload)
    if (!reply.ok) {
      throw new Error(reply.error.message + ' (' + reply.error.code + ')')
    }
    return reply.value as T
  }
  return {
    list: parentSessionId => invoke<SideChat[]>('list', { parentSessionId, includeArchived: true }),
    create: input => invoke<SideChat>('create', input),
    history: (parentSessionId, noteId) => invoke<SideChatHistory>('history', { parentSessionId, noteId }),
    followup: async (parentSessionId, noteId, text) => {
      await invoke('followup', { parentSessionId, noteId, text })
    },
    cancel: async (parentSessionId, noteId) => {
      await invoke('cancel', { parentSessionId, noteId })
    },
    archive: (parentSessionId, noteId) => invoke<SideChat>('archive', { parentSessionId, noteId }),
    restore: (parentSessionId, noteId) => invoke<SideChat>('restore', { parentSessionId, noteId }),
    promote: (parentSessionId, noteId) => invoke<SideChat>('promote', { parentSessionId, noteId }),
  }
}
