import type { SideNote } from '../domain/types.ts'
import type { SideNotesApi } from './api.ts'
import type { SideNoteHistory } from '../host/rpc.ts'

export interface CatalogSnapshot {
  readonly sessionId: string | undefined
  readonly notes: readonly SideNote[]
  readonly previews: Readonly<Record<string, string>>
  readonly questions: Readonly<Record<string, string>>
  readonly activeId: string | undefined
}

/** One shared view of Session-scoped side conversations for rail, markers and Sidebar. */
export class SideChatCatalog {
  private state: CatalogSnapshot = { sessionId: undefined, notes: [], previews: {}, questions: {}, activeId: undefined }
  private readonly listeners = new Set<() => void>()
  private listRequest: Promise<void> | undefined
  private readonly previewsInFlight = new Set<string>()
  constructor(private readonly api: SideNotesApi) {}
  readonly getSnapshot = (): CatalogSnapshot => this.state
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  private publish(update: Partial<CatalogSnapshot>): void {
    this.state = { ...this.state, ...update }
    for (const notify of this.listeners) notify()
  }
  setSession(sessionId: string | undefined): void {
    if (sessionId === this.state.sessionId) return
    this.listRequest = undefined
    this.previewsInFlight.clear()
    this.publish({ sessionId, notes: [], previews: {}, questions: {}, activeId: undefined })
  }
  setActive(activeId: string | undefined): void {
    if (this.state.activeId !== activeId) this.publish({ activeId })
  }
  upsert(note: SideNote): void {
    if (this.state.sessionId !== note.parentSessionId) return
    this.publish({
      notes: [...this.state.notes.filter(item => item.id !== note.id), note]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    })
  }
  preview(noteId: string, history: SideNoteHistory): void {
    const reply = [...history.items].reverse().find(item => item.role === 'assistant')?.text
    const question = history.items.find(item => item.role === 'user')?.text
    if (reply === this.state.previews[noteId] && question === this.state.questions[noteId]) return
    this.publish({
      previews: reply === undefined ? this.state.previews : { ...this.state.previews, [noteId]: reply.slice(0, 400) },
      questions: question === undefined ? this.state.questions : { ...this.state.questions, [noteId]: question.slice(0, 200) },
    })
  }
  refresh(sessionId: string): Promise<void> {
    this.setSession(sessionId)
    if (this.listRequest) return this.listRequest
    const task = this.api.list(sessionId).then(notes => {
      if (this.state.sessionId !== sessionId) return
      this.publish({ notes: [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) })
      for (const note of notes.filter(note => note.status === 'active').slice(-40)) {
        this.loadPreview(sessionId, note.id)
      }
    }).finally(() => {
      if (this.listRequest === task) this.listRequest = undefined
    })
    this.listRequest = task
    return task
  }
  private loadPreview(sessionId: string, noteId: string): void {
    if (this.state.questions[noteId] !== undefined || this.previewsInFlight.has(noteId)) return
    this.previewsInFlight.add(noteId)
    void this.api.history(sessionId, noteId)
      .then(history => {
        if (this.state.sessionId === sessionId) this.preview(noteId, history)
      })
      .catch(() => { /* Sidebar can still open the entry if the Agent is transient. */ })
      .finally(() => this.previewsInFlight.delete(noteId))
  }
}
