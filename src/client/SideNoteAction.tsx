import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { SideChatIcon } from './Icon.tsx'
import { sourceExcerpt } from './source-anchor.ts'
import type { SideNoteIntentStore } from './intent.ts'

interface SideNoteActionProps extends PropsRuntime<'conversation.chat.assistant-actions'> {
  readonly intent: SideNoteIntentStore
  readonly openSideChat: () => void
}

/** Reuses the native message action rhythm: 28px icon + DSH Tooltip. */
export function SideNoteAction({ sessionId, messageId, intent, openSideChat }: SideNoteActionProps) {
  return (
    <Tooltip label="侧边聊" side="bottom">
      <button className="sc-icon-button" type="button"
        aria-label="侧边聊：就这条回复开启侧边对话"
        data-sidenotes-anchor={String(messageId)}
        onClick={() => {
          intent.open(String(sessionId), String(messageId), undefined, sourceExcerpt(String(messageId)))
          openSideChat()
        }}>
        <SideChatIcon name="side-chat" />
      </button>
    </Tooltip>
  )
}
