import { useEffect, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { SideNoteIntentStore } from './intent.ts'

interface CurrentSessionSource {
  getSnapshot(): { key?: string }
  subscribe(listener: () => void): () => void
}
interface SelectionActionProps extends PropsRuntime<'shell.overlay'> {
  readonly intent: SideNoteIntentStore
  readonly currentSession: CurrentSessionSource
  readonly openSideChat: () => void
}
interface SelectionTarget {
  readonly sessionId: string
  readonly messageId: string
  readonly text: string
  readonly left: number
  readonly top: number
}

/** A separate selection affordance that does not take over DSH's Quote popup. */
export function SideChatSelectionAction({
  intent, currentSession, openSideChat,
}: SelectionActionProps) {
  const [target, setTarget] = useState<SelectionTarget | null>(null)
  useEffect(() => {
    let frame: number | undefined
    const reset = (): void => setTarget(null)
    const inspect = (): void => {
      const sessionId = currentSession.getSnapshot().key
      const selection = document.getSelection()
      if (!sessionId || !selection || selection.isCollapsed || selection.rangeCount !== 1) {
        reset(); return
      }
      const text = selection.toString().trim()
      if (!text || text.length > 8000) { reset(); return }
      const start = selection.anchorNode
      const end = selection.focusNode
      const element = start instanceof Element ? start : start?.parentElement
      const source = element?.closest<HTMLElement>('[data-text-interaction-source]')
      if (!source || !end || !source.contains(end)) { reset(); return }
      const flowRow = source.closest<HTMLElement>('[data-chat-flow-kind]')
      const flow = flowRow?.closest<HTMLElement>('[data-chat-flow]')
      const turn = flowRow?.dataset.chatTurn
      if (!flow || turn === undefined) { reset(); return }
      const anchor = Array.from(flow.querySelectorAll<HTMLElement>('[data-sidenotes-anchor]'))
        .find(node => node.closest<HTMLElement>('[data-chat-turn]')?.dataset.chatTurn === turn)
      if (!anchor?.dataset.sidenotesAnchor) { reset(); return }
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0 ||
        rect.bottom < 0 || rect.top > window.innerHeight) { reset(); return }
      // DSH Quote popup appears above the selection; Side Chat sits beside it.
      const left = Math.max(8, Math.min(window.innerWidth - 88, rect.right + 10))
      const top = Math.max(8, Math.min(window.innerHeight - 38, rect.top))
      setTarget({ sessionId, messageId: anchor.dataset.sidenotesAnchor, text, left, top })
    }
    const schedule = (): void => {
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = undefined
        inspect()
      })
    }
    const pointerUp = (event: PointerEvent): void => {
      if (event.target instanceof Element && event.target.closest('[data-side-chat-selection-button]')) return
      schedule()
    }
    const keyUp = (event: KeyboardEvent): void => {
      if (event.key === 'Shift' || event.shiftKey) schedule()
    }
    document.addEventListener('pointerup', pointerUp)
    document.addEventListener('keyup', keyUp)
    document.addEventListener('selectionchange', schedule)
    window.addEventListener('scroll', reset, true)
    window.addEventListener('resize', reset)
    const unsubscribe = currentSession.subscribe(reset)
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      document.removeEventListener('pointerup', pointerUp)
      document.removeEventListener('keyup', keyUp)
      document.removeEventListener('selectionchange', schedule)
      window.removeEventListener('scroll', reset, true)
      window.removeEventListener('resize', reset)
      unsubscribe()
    }
  }, [currentSession])

  if (!target) return null
  return (
    <button type="button" data-side-chat-selection-button
      title="就选中的内容发起独立侧聊"
      aria-label="侧聊：就选中的内容发起侧边对话"
      onPointerDown={event => event.preventDefault()}
      onClick={() => {
        intent.open(target.sessionId, target.messageId, target.text)
        setTarget(null)
        openSideChat()
      }}
      style={{
        position: 'fixed', left: target.left, top: target.top,
        zIndex: 100, pointerEvents: 'auto',
        color: 'var(--dsw-alias-label-primary, #111827)',
        background: 'var(--dsw-alias-button-floating-fill, #fff)',
        border: '1px solid var(--dsw-alias-border-l1, #cbd5e1)',
        borderRadius: 9, boxShadow: '0 3px 14px #0002',
        cursor: 'pointer', padding: '6px 10px', fontSize: 12,
      }}>
      侧聊
    </button>
  )
}
