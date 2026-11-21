import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { SideChatIcon } from './Icon.tsx'

const MAX_INPUT_HEIGHT = 180

/** One textarea + one native-style round send/stop button. */
export function SideChatComposer({
  value, onChange, onSend, onStop, busy, generating = false, placeholder, autoFocus = false,
}: {
  value: string
  onChange(value: string): void
  onSend(): void
  onStop?: () => void
  busy: boolean
  generating?: boolean
  placeholder: string
  autoFocus?: boolean
}) {
  const input = useRef<HTMLTextAreaElement>(null)
  const resize = () => {
    const node = input.current
    if (!node) return
    node.style.height = 'auto'
    const required = node.scrollHeight
    node.style.height = Math.min(required, MAX_INPUT_HEIGHT) + 'px'
    node.style.overflowY = required > MAX_INPUT_HEIGHT ? 'auto' : 'hidden'
  }
  useLayoutEffect(resize, [value])
  // Narrowing the Sidebar changes wrapping even if the draft text is unchanged.
  useLayoutEffect(() => {
    const element = input.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(resize)
    observer.observe(element.parentElement ?? element)
    return () => observer.disconnect()
  }, [])
  const canStop = generating && onStop !== undefined
  const disabled = busy || (!canStop && !value.trim())
  const label = canStop ? '停止生成' : '发送'
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!canStop && !disabled) onSend()
  }
  return (
    <div className="sc-composer">
      <div className="sc-input-wrap">
        <textarea ref={input} autoFocus={autoFocus} className="sc-composer-input"
          rows={1} aria-label={placeholder} placeholder={placeholder}
          value={value} disabled={busy} onChange={event => onChange(event.target.value)}
          onKeyDown={keyDown} />
        <div className="sc-send-anchor">
          <Tooltip label={label} side="top">
            <button className="sc-send" type="button" aria-label={label}
              disabled={disabled} onClick={canStop ? onStop : onSend}>
              <SideChatIcon name={canStop ? 'stop' : 'send'} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
