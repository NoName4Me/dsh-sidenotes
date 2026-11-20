import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { SideNote } from '../domain/types.ts'
import type { SideNoteHistory } from '../host/rpc.ts'
import { SIDENOTES_CHANNEL } from '../shared/channel.ts'

export interface SideNotesApi {
  list(parentSessionId: string): Promise<SideNote[]>
  create(input: {
    parentSessionId: string
    clientRequestId: string
    anchor: { messageId: string; selectedText?: string }
    title?: string
    mode?: 'light' | 'fork'
  }): Promise<SideNote>
  history(parentSessionId: string, noteId: string): Promise<SideNoteHistory>
  followup(parentSessionId: string, noteId: string, text: string): Promise<void>
  cancel(parentSessionId: string, noteId: string): Promise<void>
  archive(parentSessionId: string, noteId: string): Promise<SideNote>
  restore(parentSessionId: string, noteId: string): Promise<SideNote>
  promote(parentSessionId: string, noteId: string): Promise<SideNote>
}

export function createSideNotesApi(ctx: Context): SideNotesApi {
  const connection = ctx.get('connection') as ConnectionHandle
  async function invoke<T>(operation: string, payload: object): Promise<T> {
    const reply = await connection.rpc.call(SIDENOTES_CHANNEL, operation, payload)
    if (!reply.ok) {
      throw new Error(reply.error.message + ' (' + reply.error.code + ')')
    }
    return reply.value as T
  }
  return {
    list: parentSessionId => invoke<SideNote[]>('list', { parentSessionId, includeArchived: true }),
    create: input => invoke<SideNote>('create', input),
    history: (parentSessionId, noteId) => invoke<SideNoteHistory>('history', { parentSessionId, noteId }),
    followup: async (parentSessionId, noteId, text) => {
      await invoke('followup', { parentSessionId, noteId, text })
    },
    cancel: async (parentSessionId, noteId) => {
      await invoke('cancel', { parentSessionId, noteId })
    },
    archive: (parentSessionId, noteId) => invoke<SideNote>('archive', { parentSessionId, noteId }),
    restore: (parentSessionId, noteId) => invoke<SideNote>('restore', { parentSessionId, noteId }),
    promote: (parentSessionId, noteId) => invoke<SideNote>('promote', { parentSessionId, noteId }),
  }
}
