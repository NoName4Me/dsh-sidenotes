import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { SideNoteIntentStore } from './intent.ts'

interface SideNoteActionProps extends PropsRuntime<'conversation.chat.assistant-actions'> {
  readonly intent: SideNoteIntentStore
  readonly openSideChat: () => void
}

export function SideNoteAction({ sessionId, messageId, intent, openSideChat }: SideNoteActionProps) {
  return (
    <button
      type="button"
      data-sidenotes-anchor={String(messageId)}
      title="侧聊：就此消息开启独立对话"
      onClick={() => {
        const selection = window.getSelection()?.toString().trim() ?? ''
        intent.open(String(sessionId), String(messageId), selection)
        openSideChat()
      }}
      style={{
        fontSize: 12, border: 'none', background: 'transparent',
        color: 'var(--dsh-color-text-secondary, #64748b)',
        padding: '4px 8px', cursor: 'pointer',
      }}
    >
      旁注
    </button>
  )
}
