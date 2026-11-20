import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { createBringBack } from './bring-back.ts'
import { createSideNotesApi } from './api.ts'
import { SideNoteIntentStore } from './intent.ts'
import { SideNoteAction } from './SideNoteAction.tsx'
import { SideNotesOverlay } from './SideNotesOverlay.tsx'
import { SideChatSelectionAction } from './SideChatSelectionAction.tsx'
import { sideChatStyles } from './styles.ts'
import { SideChatCatalog } from './catalog.ts'
import { SideChatRail } from './SideChatRail.tsx'
import { SideChatMarkers } from './SideChatMarkers.tsx'

export const name = 'dsh-sidenotes-client'
export const inject = ['slots', 'connection', 'uiSession', 'sessions', 'conversation', 'sidebarRight', 'sidebarRightTabs']

/**
 * The DSH right Sidebar is the sole Side Chat container.
 * No independent fixed-position right rail competes with Turn Navigator,
 * the file/browser panes, or the native Sidebar's resize and float controls.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-plugin-style', 'dsh-sidenotes')
    style.textContent = sideChatStyles
    document.head.append(style)
    return () => style.remove()
  }, 'side-chat: theme-aligned styles')
  const intent = new SideNoteIntentStore()
  const api = createSideNotesApi(ctx)
  const catalog = new SideChatCatalog(api)
  const bringBack = createBringBack(ctx)
  const openSideChat = (): void => ctx.sidebarRight.openTab('side-chat')
  const currentSession = ctx.uiSession.adapter.current

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: 'dsh-sidenotes-side-chat',
    kind: 'side-chat',
    title: () => '旁敲侧击',
    guide: [{
      id: 'side-chat', order: 85,
      title: () => '旁敲侧击',
      description: () => '对主对话选中的内容发起独立侧聊',
    }],
  }), 'side-chat: native Sidebar tab definition')

  ctx.slots.inject('conversation.chat.assistant-actions', () =>
    ctx.slots.register({
      name: 'conversation.chat.assistant-actions',
      id: 'dsh-sidenotes-action',
      order: 90,
      inject: () => ({ intent, openSideChat }),
    }, SideNoteAction))

  ctx.slots.inject('sidebar.right.pane.tab', () =>
    ctx.slots.register({
      name: 'sidebar.right.pane.tab',
      key: 'dsh-sidenotes-side-chat',
      inject: () => ({ intent, api, bringBack, currentSession, catalog }),
    }, SideNotesOverlay))

  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({
      name: 'shell.overlay',
      id: 'dsh-sidenotes-rail',
      inject: () => ({ intent, currentSession, catalog, openSideChat }),
    }, SideChatRail))

  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({
      name: 'shell.overlay',
      id: 'dsh-sidenotes-anchors',
      inject: () => ({ intent, currentSession, catalog, openSideChat }),
    }, SideChatMarkers))

  // Selection is independent of the built-in Quote text-interaction
  // consumer: it must not steal that consumer's registered popup slot.
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({
      name: 'shell.overlay',
      id: 'dsh-sidenotes-selection',
      inject: () => ({ intent, currentSession, openSideChat }),
    }, SideChatSelectionAction))
}
