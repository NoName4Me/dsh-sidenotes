import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { SideNote } from '../domain/types.ts'
import type { SideNoteHistory } from '../host/rpc.ts'
import type { SideNotesApi } from './api.ts'
import type { SideChatCatalog } from './catalog.ts'
import type { SideNoteIntent, SideNoteIntentStore } from './intent.ts'
import { SideChatIcon, SideChatIconButton } from './Icon.tsx'
import { jumpToSource } from './source-anchor.ts'

interface CurrentSessionSource {
  getSnapshot(): { key?: string }
  subscribe(listener: () => void): () => void
}
interface SideNotesOverlayProps {
  readonly api: SideNotesApi
  readonly catalog: SideChatCatalog
  readonly bringBack: (parentSessionId: string, title: string, text: string) => boolean
  readonly intent: SideNoteIntentStore
  readonly currentSession: CurrentSessionSource
}
type View = 'directory' | 'create' | 'thread'

function statusOf(note: SideNote): string {
  if (note.status === 'archived') return '已归档'
  if (note.status === 'promoted') return '已升格'
  return note.mode === 'fork' ? '继承上下文' : '独立上下文'
}

/** Native right-Sidebar page: one screen at a time, never a second floating rail. */
export function SideNotesOverlay({
  api, catalog, bringBack, intent, currentSession,
}: SideNotesOverlayProps) {
  const state = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot)
  const [sessionId, setSessionId] = useState<string | undefined>(() => currentSession.getSnapshot().key)
  const [request, setRequest] = useState<SideNoteIntent | undefined>(() => intent.getSnapshot())
  const [view, setView] = useState<View>('directory')
  const [activeId, setActiveId] = useState<string | undefined>()
  const [mode, setMode] = useState<'light' | 'fork'>('light')
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState<SideNoteHistory | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [notice, setNotice] = useState<string | undefined>()
  const [copied, setCopied] = useState<string | undefined>()
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(n => n + 1), [])

  useEffect(() => currentSession.subscribe(() => setSessionId(currentSession.getSnapshot().key)), [currentSession])
  useEffect(() => intent.subscribe(() => setRequest(intent.getSnapshot())), [intent])
  useEffect(() => {
    setActiveId(undefined)
    setHistory(undefined)
    setView('directory')
    setDraft('')
    setError(undefined)
    setNotice(undefined)
    catalog.setSession(sessionId)
  }, [sessionId, catalog])
  useEffect(() => {
    if (!sessionId) return
    void catalog.refresh(sessionId).catch(error => setError(String(error)))
  }, [catalog, sessionId, revision])
  useEffect(() => {
    if (!request || request.sessionId !== sessionId) return
    setError(undefined); setNotice(undefined); setHistory(undefined)
    if (request.existingNoteId) {
      setActiveId(request.existingNoteId)
      catalog.setActive(request.existingNoteId)
      setView('thread')
    } else {
      setActiveId(undefined)
      catalog.setActive(undefined)
      setView('create')
      setDraft('')
    }
  }, [request, sessionId, catalog])
  useEffect(() => {
    if (!sessionId || !activeId || view !== 'thread') return
    let closed = false
    let inFlight = false
    const load = async () => {
      if (inFlight || closed) return
      inFlight = true
      try {
        const latest = await api.history(sessionId, activeId)
        if (!closed) {
          setHistory(latest)
          catalog.preview(activeId, latest)
        }
      } catch (err) {
        if (!closed) setError(String(err))
      } finally { inFlight = false }
    }
    void load()
    const timer = window.setInterval(() => void load(), 1250)
    return () => { closed = true; window.clearInterval(timer) }
  }, [api, catalog, sessionId, activeId, view])

  const notes = state.sessionId === sessionId ? state.notes : []
  const active = notes.find(note => note.id === activeId)
  const query = search.trim().toLowerCase()
  const filtered = notes.filter(note => {
    const original = note.anchor.selectedText ?? note.title
    return (original + ' ' + (state.previews[note.id] ?? '')).toLowerCase().includes(query)
  })
  const back = () => {
    setActiveId(undefined); setView('directory'); setHistory(undefined)
    catalog.setActive(undefined); setError(undefined); setNotice(undefined)
  }
  const openNote = (noteId: string) => {
    setActiveId(noteId); setView('thread')
    setHistory(undefined); setDraft(''); setError(undefined)
    catalog.setActive(noteId)
  }
  const invoke = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setError(undefined); setNotice(undefined)
    try {
      await action()
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setBusy(false) }
  }
  const create = () => {
    if (!sessionId || !request || request.sessionId !== sessionId || !draft.trim()) return
    const question = draft.trim()
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
      catalog.upsert(note)
      openNote(note.id)
      await api.followup(sessionId, note.id, question)
      setDraft('')
    })
  }
  const send = () => {
    if (!sessionId || !activeId || !draft.trim()) return
    const question = draft.trim()
    void invoke(async () => {
      await api.followup(sessionId, activeId, question)
      setDraft('')
    })
  }
  const summarize = () => {
    if (!sessionId || !activeId || active?.status !== 'active') return
    void invoke(() => api.followup(sessionId, activeId,
      '请概括本次侧聊已经确定的结论、关键依据和待解决的问题。请简洁准确，不引入没有讨论过的假设。'))
    setNotice('已请求生成摘要，完成后可选择引用到主对话')
  }
  const change = (operation: 'archive' | 'restore' | 'promote') => {
    if (!sessionId || !activeId) return
    void invoke(async () => {
      const note = await api[operation](sessionId, activeId)
      catalog.upsert(note)
      if (operation === 'promote') setNotice('已升格为正式对话，可在会话列表中继续')
      if (operation === 'archive') back()
    })
  }
  const jump = () => {
    if (!active) return
    const result = jumpToSource(active.anchor.messageId, active.anchor.selectedText)
    if (result === 'not-loaded') setError('来源消息尚未加载。可先滚动主会话加载对应历史。')
    else if (result === 'quote-not-found') setError('原文内容已变化，无法精确定位选中片段。')
    else { setError(undefined); setNotice('已定位并高亮来源') }
  }
  const copy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(id); setNotice('已复制')
    }).catch(() => setError('复制失败，请选中文本后复制'))
  }
  const quote = (text: string) => {
    if (!sessionId || !active) return
    if (bringBack(sessionId, active.title, text)) {
      setNotice('已插入主对话草稿，尚未发送')
      setError(undefined)
    } else setError('主对话编辑器暂不可用，请稍后重试')
  }
  if (!sessionId) return <div className="sc-empty">选择一段主对话后即可使用侧聊</div>

  return (
    <section className="sc-root" aria-label="旁敲侧击 · Side Chat">
      <header className="sc-header">
        {view !== 'directory' && <SideChatIconButton label="返回侧聊目录" icon="back" onClick={back} />}
        <div className="sc-heading">{view === 'thread' ? active?.title ?? '侧边对话' :
          view === 'create' ? '发起侧聊' : '旁敲侧击'}</div>
        {view === 'directory' && <span className="sc-status">{notes.filter(n => n.status === 'active').length} 条侧聊</span>}
        {view === 'thread' && active && (
          <div className="sc-toolbar">
            <SideChatIconButton label="定位并高亮原消息" icon="locate" onClick={jump} />
            {active.status === 'active' && <SideChatIconButton label="生成侧聊摘要" icon="sparkle" disabled={busy} onClick={summarize} />}
            {active.status === 'active' && <SideChatIconButton label="归档侧聊" icon="archive" disabled={busy} onClick={() => change('archive')} />}
            {active.status === 'archived' && <SideChatIconButton label="恢复侧聊" icon="restore" disabled={busy} onClick={() => change('restore')} />}
            {active.status !== 'promoted' && <SideChatIconButton label="升格为正式对话" icon="promote" disabled={busy} onClick={() => change('promote')} />}
          </div>
        )}
      </header>

      {view === 'directory' && (
        <div className="sc-scroll">
          <div className="sc-padded" style={{ paddingBottom: 8 }}>
            <div className="sc-muted" style={{ marginBottom: 12 }}>
              围绕主对话的独立讨论，不打断原有上下文。
            </div>
            <input className="sc-field" aria-label="搜索侧聊"
              placeholder="搜索引用内容或回答..." value={search}
              onChange={event => setSearch(event.target.value)} />
          </div>
          <div style={{ padding: '0 9px 16px' }}>
            {filtered.length === 0 && <p className="sc-empty">{query ? '没有找到匹配内容' : '选中回复中的文字，或点击消息下方的侧聊图标，即可开始。'}</p>}
            {filtered.map(note => (
              <button type="button" key={note.id} className="sc-item"
                data-active={activeId === note.id} onClick={() => openNote(note.id)}>
                <div className="sc-item-title">{note.anchor.selectedText || note.title}</div>
                <div className="sc-item-preview">{state.previews[note.id] || '暂无回答'}</div>
                <div className="sc-status" style={{ marginTop: 5 }}>{statusOf(note)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'create' && (
        <>
          <div className="sc-scroll sc-padded" style={{ display: 'grid', alignContent: 'start', gap: 14 }}>
            <div>
              <div className="sc-section-label">引用自主对话</div>
              <blockquote className="sc-quote">{request?.selectedText || '整条 AI 回复'}</blockquote>
            </div>
            <div>
              <label htmlFor="sc-context-mode" className="sc-section-label" style={{ display: 'block' }}>上下文范围</label>
              <select id="sc-context-mode" value={mode} className="sc-field"
                onChange={event => setMode(event.target.value as 'light' | 'fork')}>
                <option value="light">轻量 · 围绕引用讨论</option>
                <option value="fork">继承 · 带入此前主对话</option>
              </select>
            </div>
            <p className="sc-muted" style={{ margin: 0 }}>侧聊会独立保存，不会向主对话自动发送内容。</p>
          </div>
          <div className="sc-composer">
            <textarea autoFocus className="sc-field sc-textarea" aria-label="新侧聊问题"
              placeholder="想就这段内容问什么？" rows={4} value={draft} disabled={busy}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); create() } }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="sc-btn sc-btn-primary" disabled={!draft.trim() || busy} onClick={create}>
                <SideChatIcon name="send" /> 发起侧聊
              </button>
            </div>
          </div>
        </>
      )}

      {view === 'thread' && active && (
        <>
          <div className="sc-message-header">
            <div className="sc-status">独立对话 · {statusOf(active)}</div>
            <blockquote className="sc-quote">{active.anchor.selectedText || '引用整条 AI 回复'}</blockquote>
          </div>
          <div className="sc-scroll" role="log" aria-live="polite">
            <div className="sc-msg-list">
              {history?.items.map(item => (
                <div className={'sc-msg ' + (item.role === 'user' ? 'sc-msg-user' : 'sc-msg-assistant')}
                  key={item.messageId}>
                  <div>{item.text}</div>
                  {item.role === 'assistant' && (
                    <div className="sc-msg-actions">
                      <SideChatIconButton label={copied === item.messageId ? '已复制' : '复制回答'}
                        icon={copied === item.messageId ? 'check' : 'copy'}
                        onClick={() => copy(item.messageId, item.text)} />
                      <SideChatIconButton label="引用到主对话草稿（不会自动发送）"
                        icon="quote" onClick={() => quote(item.text)} />
                    </div>
                  )}
                </div>
              ))}
              {!history && <div className="sc-empty">正在读取对话记录…</div>}
              {history?.busy && <div className="sc-status">正在生成回答…</div>}
              {history?.items.length === 0 && !history.busy &&
                <div className="sc-empty">这是一个新的侧聊，输入问题即可开始。</div>}
            </div>
          </div>
          {active.status === 'active' ? (
            <div className="sc-composer">
              <textarea className="sc-field sc-textarea" rows={2}
                aria-label="继续侧聊" placeholder="继续追问…（Ctrl/⌘ + Enter 发送）"
                disabled={busy} value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); send() } }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sc-status">与主对话相互隔离</span>
                <div className="sc-toolbar">
                  {history?.busy && <SideChatIconButton label="停止生成" icon="stop"
                    disabled={busy} onClick={() => void invoke(() => api.cancel(sessionId, active.id))} />}
                  <button className="sc-btn sc-btn-primary" disabled={busy || !draft.trim()} onClick={send}>
                    <SideChatIcon name="send" /> 发送
                  </button>
                </div>
              </div>
            </div>
          ) : <div className="sc-composer sc-status">本侧聊已{active.status === 'promoted' ? '升格为正式对话' : '归档'}。{active.status === 'archived' ? '恢复后可继续追问。' : '可从正式会话列表继续。'}</div>}
        </>
      )}
      {view === 'thread' && !active && <div className="sc-empty">侧聊不存在或已被删除，请返回目录。</div>}
      {notice && <div className="sc-status" role="status" style={{ padding: '7px 14px' }}>{notice}</div>}
      {error && <div className="sc-alert" role="alert">{error}</div>}
    </section>
  )
}
