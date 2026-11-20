import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { IconBranchOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SideChatCatalog } from './catalog.ts'
import type { SideNoteIntentStore } from './intent.ts'
import { locateQuote, locateSource } from './source-anchor.ts'

interface CurrentSessionSource {
  getSnapshot(): { key?: string }
  subscribe(listener: () => void): () => void
}
interface AnchorMark {
  id: string
  title: string
  left: number
  top: number
}
export function SideChatMarkers({ catalog, currentSession, intent, openSideChat }: {
  catalog: SideChatCatalog
  currentSession: CurrentSessionSource
  intent: SideNoteIntentStore
  openSideChat: () => void
}) {
  const state = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot)
  const [marks, setMarks] = useState<AnchorMark[]>([])
  const [sessionId, setSessionId] = useState(currentSession.getSnapshot().key)
  useEffect(() => currentSession.subscribe(() => setSessionId(currentSession.getSnapshot().key)), [currentSession])
  const notes = useMemo(() => state.sessionId === sessionId
    ? state.notes.filter(note => note.status === 'active') : [],
  [state.sessionId, state.notes, sessionId])
  useEffect(() => {
    let frame: number | undefined
    const update = () => {
      frame = undefined
      const next: AnchorMark[] = []
      const occupied = new Map<string, number>()
      for (const note of notes) {
        const location = locateSource(note.anchor.messageId)
        if (!location) continue
        const flow = location.row.closest<HTMLElement>('[data-chat-flow]')
        if (!flow) continue
        const flowRect = flow.getBoundingClientRect()
        const range = note.anchor.selectedText && location.source
          ? locateQuote(location.source, note.anchor.selectedText) : null
        const rect = range?.getBoundingClientRect() ?? location.row.getBoundingClientRect()
        const x = flowRect.right + 8
        const y = Math.max(rect.top + 4, 0)
        if (x > innerWidth - 25 || x < 0 || y < 65 || y > innerHeight - 50) continue
        const key = note.anchor.messageId + ':' + Math.round(y / 18)
        const offset = occupied.get(key) ?? 0
        occupied.set(key, offset + 1)
        next.push({ id: note.id, title: note.anchor.selectedText || note.title,
          left: x, top: y + offset * 23 })
      }
      setMarks(previous =>
        previous.length === next.length && previous.every((mark, i) =>
          mark.id === next[i]?.id && mark.left === next[i]?.left && mark.top === next[i]?.top)
          ? previous : next)
    }
    const schedule = () => {
      if (frame === undefined) frame = requestAnimationFrame(update)
    }
    schedule()
    const flow = document.querySelector<HTMLElement>('[data-chat-flow]')
    const mutation = new MutationObserver(schedule)
    if (flow) mutation.observe(flow, { childList: true, subtree: true })
    document.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    const fallback = window.setInterval(schedule, 3500)
    return () => {
      mutation.disconnect()
      document.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      window.clearInterval(fallback)
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }, [notes])
  if (!sessionId || marks.length === 0) return null
  return (
    <div className="sc-anchor-markers" aria-label="消息侧聊锚点">
      {marks.map(mark => (
        <Tooltip key={mark.id} label={mark.title} side="right">
          <button className="sc-anchor-button" type="button"
            aria-label={'打开此处侧聊：' + mark.title}
            style={{ left: mark.left, top: mark.top }}
            onClick={() => {
              catalog.setActive(mark.id)
              intent.openExisting(sessionId, mark.id)
              openSideChat()
            }}>
            <IconBranchOutlineRegular />
          </button>
        </Tooltip>
      ))}
    </div>
  )
}
