export interface SideChatIntent {
  readonly sessionId: string
  readonly messageId: string
  readonly selectedText?: string
  readonly sourceTitle?: string
  readonly existingNoteId?: string
  readonly sequence: number
}

export class SideChatIntentStore {
  private current: SideChatIntent | undefined
  private sequence = 0
  private readonly listeners = new Set<() => void>()

  open(sessionId: string, messageId: string, selectedText?: string, sourceTitle?: string): void {
    this.current = {
      sessionId,
      messageId,
      ...(selectedText ? { selectedText: selectedText.slice(0, 8000) } : {}),
      ...(sourceTitle ? { sourceTitle: sourceTitle.slice(0, 120) } : {}),
      sequence: ++this.sequence,
    }
    for (const fn of this.listeners) fn()
  }

  openExisting(sessionId: string, existingNoteId: string): void {
    this.current = { sessionId, messageId: '', existingNoteId, sequence: ++this.sequence }
    for (const fn of this.listeners) fn()
  }

  getSnapshot = (): SideChatIntent | undefined => this.current

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}
