import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { SideChatIntentStore } from './intent.ts'

interface CurrentSessionSource {
  getSnapshot(): { key?: string }
  subscribe(listener: () => void): () => void
}
interface SelectionActionProps extends PropsRuntime<'shell.overlay'> {
  readonly intent: SideChatIntentStore
  readonly currentSession: CurrentSessionSource
  readonly openSideChat: () => void
}
interface SelectionTarget {
  readonly sessionId: string
  readonly messageId: string
  readonly text: string
  /** The existing Quote action's own popup: no competing floating position. */
  readonly host: HTMLElement
}

function selectedTarget(currentSession: CurrentSessionSource): Omit<SelectionTarget, 'host'> | null {
  const sessionId = currentSession.getSnapshot().key
  const selection = document.getSelection()
  if (!sessionId || !selection || selection.isCollapsed || selection.rangeCount !== 1) return null
  const text = selection.toString().trim()
  if (!text || text.length > 8000) return null
  const range = selection.getRangeAt(0)
  const sourceOf = (node: Node) =>
    (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-text-interaction-source]')
  const source = sourceOf(range.startContainer)
  if (!source || source !== sourceOf(range.endContainer)) return null
  const row = source.closest<HTMLElement>('[data-chat-turn]')
  const flow = source.closest<HTMLElement>('[data-chat-flow]')
  if (!row || !flow || !row.dataset.chatTurn) return null
  const messageAnchor = Array.from(flow.querySelectorAll<HTMLElement>('[data-sidechat-anchor]'))
    .find(button => button.closest<HTMLElement>('[data-chat-turn]')?.dataset.chatTurn === row.dataset.chatTurn)
  if (!messageAnchor?.dataset.sidechatAnchor) return null
  return { sessionId, messageId: messageAnchor.dataset.sidechatAnchor, text }
}

function quoteCapsule(): HTMLElement | null {
  // The upstream text-interaction seat already owns positioning and timing.
  // Portaling into its button wrapper adds a control to the same capsule,
  // without replacing the Quote action or changing selection geometry.
  for (const surface of Array.from(document.querySelectorAll<HTMLElement>('[data-text-interaction-surface]'))) {
    if (surface.style.visibility === 'hidden') continue
    const native = surface.querySelector<HTMLButtonElement>('button:not([data-side-chat-selection-button])')
    if (native?.parentElement) return native.parentElement
  }
  return null
}

/**
 * DSH only offers the selection action after pointerup / completed Shift
 * selection. Do not listen to selectionchange: it fires on *every* drag frame,
 * and updating state there previously made the selection/capsule flicker.
 *
 * As DSH currently exposes a keyed (exclusive) Quote seat rather than a list
 * of action additions, this contribution portals a sibling into the native
 * Quote capsule. No builtin handler is replaced, intercepted or prevented.
 */
export function SideChatSelectionAction({
  intent, currentSession, openSideChat,
}: SelectionActionProps) {
  const [target, setTarget] = useState<SelectionTarget | null>(null)
  useEffect(() => {
    let frame: number | undefined
    let generation = 0
    const clear = () => { generation++; setTarget(null) }
    const afterGesture = () => {
      const id = ++generation
      const selected = selectedTarget(currentSession)
      if (!selected) { setTarget(null); return }
      let attempts = 0
      const locate = () => {
        if (generation !== id) return
        const host = quoteCapsule()
        if (host) {
          setTarget({ ...selected, host })
          return
        }
        if (++attempts < 5) frame = window.requestAnimationFrame(locate)
      }
      frame = window.requestAnimationFrame(locate)
    }
    const pointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element &&
        event.target.closest('[data-side-chat-selection-button]')) return
      clear()
    }
    const pointerUp = (event: PointerEvent) => {
      if (event.button === 0 && !(event.target instanceof Element &&
        event.target.closest('[data-side-chat-selection-button]'))) afterGesture()
    }
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift' || !event.shiftKey) afterGesture()
    }
    document.addEventListener('pointerdown', pointerDown, true)
    document.addEventListener('pointerup', pointerUp)
    document.addEventListener('keyup', keyUp)
    window.addEventListener('blur', clear)
    const offSession = currentSession.subscribe(clear)
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', pointerDown, true)
      document.removeEventListener('pointerup', pointerUp)
      document.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', clear)
      offSession()
    }
  }, [currentSession])
  useEffect(() => {
    if (!target) return
    target.host.classList.add('sc-selection-capsule')
    return () => target.host.classList.remove('sc-selection-capsule')
  }, [target])

  if (!target || !target.host.isConnected) return null
  return createPortal(
    <button type="button" className="sc-selection-action" data-side-chat-selection-button
      aria-label="侧聊：就选中内容发起侧边对话"
      onPointerDown={event => event.preventDefault()}
      onClick={() => {
        intent.open(target.sessionId, target.messageId, target.text)
        setTarget(null)
        document.getSelection()?.removeAllRanges()
        openSideChat()
      }}>侧聊</button>,
    target.host,
  )
}
