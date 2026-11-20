import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { SideNote } from '../domain/types.ts'
import type { SideNoteHistory } from '../host/rpc.ts'
import type { SideNotesApi } from './api.ts'
import type { SideNoteIntent, SideNoteIntentStore } from './intent.ts'

interface CurrentSessionSource {
  getSnapshot(): { key?: string }
  subscribe(listener: () => void): () => void
}
interface SideNotesOverlayProps {
  readonly api: SideNotesApi
  readonly bringBack: (parentSessionId: string, title: string, text: string) => boolean
  readonly intent: SideNoteIntentStore
  readonly currentSession: CurrentSessionSource
}

const surface: CSSProperties = {
  background: 'var(--dsh-color-surface, #fff)',
  color: 'var(--dsh-color-text, #1f2937)',
  border: '1px solid var(--dsh-color-border, #cbd5e1)',
  boxShadow: '0 10px 35px rgba(0,0,0,.14)',
}
const button: CSSProperties = {
  background: 'transparent', border: '1px solid var(--dsh-color-border, #cbd5e1)',
  borderRadius: 7, padding: '6px 9px', cursor: 'pointer', color: 'inherit',
  fontSize: 12,
}
const muted: CSSProperties = { color: 'var(--dsh-color-text-secondary, #64748b)', fontSize: 12 }
const spinner: CSSProperties = { ...muted, padding: '10px 0' }

export function SideNotesOverlay({ api, bringBack, intent, currentSession }: SideNotesOverlayProps) {
  const [sessionId, setSessionId] = useState<string | undefined>(() => currentSession.getSnapshot().key)
  const [request, setRequest] = useState<SideNoteIntent | undefined>(() => intent.getSnapshot())
  const [notes, setNotes] = useState<SideNote[]>([])
  const [activeId, setActiveId] = useState<string | undefined>()
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<'light' | 'fork'>('light')
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState<SideNoteHistory | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(n => n + 1), [])

  useEffect(() => currentSession.subscribe(() => {
    setSessionId(currentSession.getSnapshot().key)
  }), [currentSession])
  useEffect(() => intent.subscribe(() => setRequest(intent.getSnapshot())), [intent])

  useEffect(() => {
    setActiveId(undefined)
    setExpanded(false)
    setHistory(undefined)
    setError(undefined)
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    api.list(sessionId).then(items => {
      if (!cancelled) setNotes(items)
    }).catch(e => {
      if (!cancelled) setError(String(e))
    })
    return () => { cancelled = true }
  }, [api, sessionId, revision])

  useEffect(() => {
    if (!request || request.sessionId !== sessionId) return
    setExpanded(true)
    setActiveId(undefined)
    setError(undefined)
    setDraft('')
  }, [request, sessionId])

  useEffect(() => {
    if (!sessionId || !activeId || !expanded) return
    let closed = false
    let inFlight = false
    const load = async () => {
      if (inFlight || closed) return
      inFlight = true
      try {
        const view = await api.history(sessionId, activeId)
        if (!closed) setHistory(view)
      } catch (e) {
        if (!closed) setError(String(e))
      } finally { inFlight = false }
    }
    void load()
    const timer = window.setInterval(() => void load(), 1100)
    return () => { closed = true; window.clearInterval(timer) }
  }, [api, sessionId, activeId, expanded])

  const active = notes.find(n => n.id === activeId)
  const visible = notes.filter(n => n.status === 'active')
  const filtered = notes.filter(n =>
    (n.title + ' ' + (n.anchor.selectedText ?? '')).toLowerCase().includes(search.trim().toLowerCase()))
  const jumpToAnchor = (messageId: string) => {
    const target = Array.from(document.querySelectorAll<HTMLElement>('[data-sidenotes-anchor]'))
      .find(element => element.dataset.sidenotesAnchor === messageId)
    if (!target) {
      setError('来源消息不在当前已加载的聊天内容中，可滚动主对话加载后再试。')
      return
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setError(undefined)
  }
  const invoke = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(undefined)
    try {
      await action()
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }
  // A question creates the side Session and starts its first turn in one action.
  const create = () => {
    if (!sessionId || !request || request.sessionId !== sessionId || !draft.trim()) return
    const firstQuestion = draft.trim()
    void invoke(async () => {
      const note = await api.create({
        parentSessionId: sessionId,
        clientRequestId: crypto.randomUUID(),
        anchor: {
          messageId: request.messageId,
          ...(request.selectedText ? { selectedText: request.selectedText } : {}),
        },
        mode,
      })
      setActiveId(note.id)
      setHistory(undefined)
      setNotes(items => [...items.filter(item => item.id !== note.id), note])
      await api.followup(sessionId, note.id, firstQuestion)
      setDraft('')
    })
  }
  const send = () => {
    if (!sessionId || !activeId || !draft.trim()) return
    const text = draft.trim()
    void invoke(async () => {
      await api.followup(sessionId, activeId, text)
      setDraft('')
    })
  }
  const summarize = () => {
    if (!sessionId || !activeId || !active || active.status !== 'active') return
    void invoke(async () => {
      await api.followup(sessionId, activeId,
        '请基于这个旁注中目前的讨论，整理一份简明结论摘要：核心概念、已经确定的结论、仍需注意的问题。不要引入主对话中尚未讨论的假设。')
    })
  }
  const copyText = (value: string) => {
    void navigator.clipboard.writeText(value).catch(() => {
      setError('复制失败，请手动选中文本复制')
    })
  }
  const change = (action: 'archive' | 'restore' | 'promote') => {
    if (!sessionId || !activeId) return
    void invoke(async () => {
      const note = await api[action](sessionId, activeId)
      setNotes(items => items.map(n => n.id === note.id ? note : n))
    })
  }

  if (!sessionId) return null
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <aside aria-label="侧聊目录" style={{ ...surface, display: expanded ? 'none' : 'flex', flex: 1, width: '100%', minHeight: 0, overflowY: 'auto', boxSizing: 'border-box', padding: 12, border: 'none', boxShadow: 'none', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, padding: '4px 3px' }}>侧聊 · {visible.length}</div>
        <button style={button} onClick={() => { setExpanded(v => !v); setActiveId(undefined); setError(undefined) }} title="浏览所有旁注">＋ / 目录</button>
        {visible.map(n => (
          <button key={n.id} type="button" title={n.title} style={{ ...button, borderColor: activeId === n.id ? '#64748b' : undefined, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => {
            setActiveId(n.id)
            setExpanded(true)
            setHistory(undefined)
            setError(undefined)
          }}>
            {n.title.slice(0, 25)}
          </button>
        ))}
      </aside>

      {expanded && (
        <section aria-label="侧边对话" style={{ ...surface, width: '100%', height: '100%', minHeight: 0, flex: 1, border: 'none', boxShadow: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <header style={{ display: 'flex', alignItems: 'center', padding: 12, borderBottom: '1px solid var(--dsh-color-border, #cbd5e1)', gap: 8 }}>
            <strong style={{ fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active?.title ?? '侧边对话'}</strong>
            <button type="button" style={button} onClick={() => setExpanded(false)} aria-label="收起旁注">收起</button>
          </header>

          {!active ? (
            <div style={{ overflowY: 'auto', padding: 14, flex: 1 }}>
              {request?.sessionId === sessionId ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <p style={{ ...muted, margin: 0 }}>来自消息的独立追问。这里的问答不会写入主对话。</p>
                  {request.selectedText && <blockquote style={{ fontSize: 12, margin: 0, padding: 9, borderLeft: '3px solid #94a3b8', maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{request.selectedText}</blockquote>}
                  <label style={{ fontSize: 12 }}>上下文模式</label>
                  <select value={mode} onChange={e => setMode(e.target.value as 'light' | 'fork')} style={{ ...button, background: 'inherit' }}>
                    <option value="light">轻量旁注</option><option value="fork">继承完整上下文（Fork）</option>
                  </select>
                  <textarea aria-label="新侧聊问题" rows={3} value={draft} disabled={busy}
                    placeholder="输入问题，发送后自动创建独立侧聊……"
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); create() } }}
                    style={{ fontFamily: 'inherit', resize: 'vertical', padding: 9, border: '1px solid #94a3b8', borderRadius: 8, color: 'inherit', background: 'inherit', fontSize: 13 }} />
                  <button style={button} disabled={busy || !draft.trim()} onClick={create}>提问并创建侧聊 Ctrl+Enter</button>
                </div>
              ) : <p style={muted}>点击主对话消息下的「侧聊」，从该消息发起新问题。</p>}
              <hr style={{ opacity: .25, margin: '16px 0' }} />
              <p style={{ fontWeight: 600, fontSize: 13 }}>全部侧聊</p>
              <input aria-label="搜索旁注" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="搜索标题或引用内容" style={{ ...button, width: '100%', boxSizing: 'border-box' }} />
              {filtered.length === 0 && <p style={muted}>无匹配侧聊</p>}
              {filtered.map(n => <button key={n.id} type="button" style={{ ...button, display: 'block', marginBottom: 6, width: '100%', textAlign: 'left' }} onClick={() => { setActiveId(n.id); setHistory(undefined) }}>
                {n.title} <span style={muted}>({n.status})</span>
              </button>)}
            </div>
          ) : (
            <>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--dsh-color-border, #cbd5e1)' }}>
                <span style={muted}>独立 Session · {active.status === 'promoted' ? '已升格' : '不影响主对话'}</span>
                <button type="button" style={{ ...button, marginTop: 6 }}
                  onClick={() => jumpToAnchor(active.anchor.messageId)}>定位原消息</button>
                {active.anchor.selectedText && <div style={{ ...muted, whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'auto', marginTop: 4 }}>引用：{active.anchor.selectedText}</div>}
              </div>
              <div role="log" aria-live="polite" style={{ padding: 12, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {history?.items.map(item => (
                  <div key={item.messageId} style={{ alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '94%', padding: 10, borderRadius: 10, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13, lineHeight: 1.5, background: item.role === 'user' ? 'var(--dsh-color-surface-secondary, #e2e8f0)' : 'var(--dsh-color-surface-tertiary, #f1f5f9)' }}>
                    {item.text}
                    {item.role === 'assistant' && (
                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="button" style={button} onClick={() => copyText(item.text)}>复制回答</button>
                        <button type="button" style={button} onClick={() => {
                          if (!bringBack(sessionId, active.title, item.text)) {
                            setError('主会话编辑器暂不可用，请稍后再试')
                          } else {
                            setError(undefined)
                          }
                        }} title="仅在主会话输入框插入引用，不自动发送">引用到主对话草稿</button>
                      </div>
                    )}
                  </div>
                ))}
                {!history && <div style={spinner}>正在加载侧聊历史……</div>}
                {history?.busy && <div style={spinner}>正在生成回答……</div>}
              </div>
              {active.status === 'active' && (
                <div style={{ padding: 10, borderTop: '1px solid var(--dsh-color-border, #cbd5e1)', display: 'grid', gap: 8 }}>
                  <textarea aria-label="旁注问题" rows={3} value={draft} disabled={busy} placeholder="继续追问……" onChange={e => setDraft(e.target.value)} onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send() }
                  }} style={{ fontFamily: 'inherit', resize: 'vertical', padding: 9, border: '1px solid #94a3b8', borderRadius: 8, color: 'inherit', background: 'inherit', fontSize: 13 }} />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button style={button} disabled={busy} onClick={() => void invoke(() => api.cancel(sessionId, active.id))}>停止</button>
                    <button style={button} disabled={busy || !draft.trim()} onClick={send}>发送 Ctrl+Enter</button>
                  </div>
                </div>
              )}
              <footer style={{ padding: '8px 12px', borderTop: '1px solid var(--dsh-color-border, #cbd5e1)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {active.status === 'archived' && <button style={button} onClick={() => change('restore')}>恢复</button>}
                {active.status === 'active' && <button style={button} disabled={busy} onClick={summarize}>整理侧聊摘要</button>}
                {active.status === 'active' && <button style={button} onClick={() => change('archive')}>归档</button>}
                {active.status !== 'promoted' && <button style={button} onClick={() => change('promote')}>升格正式对话</button>}
                <button style={button} onClick={() => { setActiveId(undefined); setHistory(undefined) }}>返回目录</button>
              </footer>
            </>
          )}
          {error && <div role="alert" style={{ color: '#b91c1c', fontSize: 12, padding: '7px 12px' }}>{error}</div>}
        </section>
      )}
    </div>
  )
}
