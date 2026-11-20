import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { IconSearchOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SideChatCatalog } from './catalog.ts'
import type { SideNoteIntentStore } from './intent.ts'

interface CurrentSessionSource {
  getSnapshot(): { key?: string }
  subscribe(listener: () => void): () => void
}
export interface SideChatRailProps {
  catalog: SideChatCatalog
  intent: SideNoteIntentStore
  currentSession: CurrentSessionSource
  openSideChat: () => void
}
interface RailGeometry { left: number; top: number }
function railGeometry(): RailGeometry | null {
  const native = Array.from(document.querySelectorAll<HTMLElement>('[data-chat-aside] nav'))
    .find(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
  if (native) {
    const rect = native.getBoundingClientRect()
    return { left: Math.max(5, rect.left - 32), top: Math.max(64, rect.top) }
  }
  const flow = document.querySelector<HTMLElement>('[data-chat-flow]')
  if (!flow) return null
  const rect = flow.getBoundingClientRect()
  if (rect.width < 200) return null
  return { left: Math.max(5, rect.left - 34), top: Math.max(72, window.innerHeight / 2 - 80) }
}
export function SideChatRail({ catalog, intent, currentSession, openSideChat }: SideChatRailProps) {
  const state = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot)
  const [sessionId, setSessionId] = useState(currentSession.getSnapshot().key)
  const [geometry, setGeometry] = useState<RailGeometry | null>(null)
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const closeTimer = useRef<number | null>(null)

  useEffect(() => currentSession.subscribe(() => {
    setSessionId(currentSession.getSnapshot().key)
    setOpen(false); setPinned(false)
  }), [currentSession])
  useEffect(() => {
    catalog.setSession(sessionId)
    if (!sessionId) return
    void catalog.refresh(sessionId).catch(() => {})
    const interval = window.setInterval(() => void catalog.refresh(sessionId).catch(() => {}), 12_000)
    return () => window.clearInterval(interval)
  }, [catalog, sessionId])
  useEffect(() => {
    let frame: number | null = null
    const place = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        const next = railGeometry()
        setGeometry(before => before?.left === next?.left && before?.top === next?.top ? before : next)
      })
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(document.documentElement)
    document.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    const fallback = window.setInterval(place, 3000)
    return () => {
      observer.disconnect()
      document.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      window.clearInterval(fallback)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [sessionId])
  useEffect(() => () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current)
  }, [])
  const show = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    setOpen(true)
  }
  const leave = () => {
    if (pinned) return
    closeTimer.current = window.setTimeout(() => setOpen(false), 180)
  }
  const activate = useCallback((noteId: string) => {
    if (!sessionId) return
    catalog.setActive(noteId)
    intent.openExisting(sessionId, noteId)
    openSideChat()
    setOpen(false); setPinned(false)
  }, [sessionId, catalog, intent, openSideChat])
  const notes = state.sessionId === sessionId ? state.notes : []
  const activeNotes = notes.filter(note => note.status === 'active')
  const filtered = notes.filter(note => (
    (note.anchor.selectedText ?? '') + ' ' + note.title + ' ' + (state.previews[note.id] ?? '')
  ).toLowerCase().includes(search.toLowerCase().trim()))
  if (!sessionId || !geometry || activeNotes.length === 0) return null
  return (
    <nav className="sc-rail" aria-label="旁敲侧击侧聊目录"
      style={{ left: geometry.left, top: geometry.top }}
      onPointerEnter={show} onPointerLeave={leave}
      onFocus={show} onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) leave()
      }}>
      <div className="sc-rail-column">
        <Tooltip label="搜索侧聊" side="right">
          <button className="sc-rail-trigger" type="button"
            aria-label="搜索侧聊" onClick={() => {
              setPinned(value => !value)
              setOpen(true)
              window.requestAnimationFrame(() => inputRef.current?.focus())
            }}>
            <IconSearchOutlineRegular />
          </button>
        </Tooltip>
        {activeNotes.map(note => (
          <Tooltip key={note.id} label={note.anchor.selectedText ?? note.title} side="left">
            <button className="sc-rail-trigger" type="button"
              aria-label={'打开侧聊：' + note.title} onClick={() => activate(note.id)}>
              <span className="sc-rail-dot" data-active={note.id === state.activeId} />
            </button>
          </Tooltip>
        ))}
      </div>
      {open && (
        <div className="sc-rail-popover" role="dialog" aria-label="侧聊目录">
          <div className="sc-rail-top">
            <div className="sc-heading" style={{ paddingBottom: 10 }}>旁敲侧击 <span className="sc-muted">· {activeNotes.length}</span></div>
            <input ref={inputRef} className="sc-field" aria-label="搜索侧聊"
              placeholder="搜索引用与回答..." value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <div className="sc-rail-results">
            {filtered.length === 0 && <div className="sc-empty">没有找到匹配的侧聊</div>}
            {filtered.map(note => (
              <button key={note.id} type="button" className="sc-item"
                data-active={state.activeId === note.id} onClick={() => activate(note.id)}>
                <div className="sc-item-excerpt" style={{ marginTop: 0 }}>{note.anchor.selectedText || note.title}</div>
                <div className="sc-item-preview">{state.previews[note.id] || '暂无回答'}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
