import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { createBringBack } from './bring-back.ts'
import { createSideNotesApi } from './api.ts'
import { SideNoteIntentStore } from './intent.ts'
import { SideNoteAction } from './SideNoteAction.tsx'
import { SideNotesOverlay } from './SideNotesOverlay.tsx'

export const name = 'dsh-sidenotes-client'
export const inject = ['slots', 'connection', 'uiSession', 'sessions', 'conversation']

/** Additive UI Seats only. Nothing replaces Harness Chat or the right sidebar. */
export function apply(ctx: Context): void {
  const intent = new SideNoteIntentStore()
  const api = createSideNotesApi(ctx)
  const bringBack = createBringBack(ctx)

  ctx.slots.inject('conversation.chat.assistant-actions', () =>
    ctx.slots.register({
      name: 'conversation.chat.assistant-actions',
      id: 'dsh-sidenotes-action',
      order: 90,
      inject: () => ({ intent }),
    }, SideNoteAction))

  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({
      name: 'shell.overlay',
      id: 'dsh-sidenotes-rail',
      inject: () => ({
        intent, api, bringBack, currentSession: ctx.uiSession.adapter.current,
      }),
    }, SideNotesOverlay))
}
