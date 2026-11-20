export type ContextMode = 'light' | 'fork'
export type SideNoteStatus = 'active' | 'archived' | 'promoted'

export interface SideNoteAnchor {
  messageId: string
  eventSeq?: number
  selectedText?: string
}

export interface SideNote {
  id: string
  parentSessionId: string
  childSessionId: string | null
  clientRequestId: string
  anchor: SideNoteAnchor
  title: string
  mode: ContextMode
  status: SideNoteStatus
  promotedSessionId?: string
  createdAt: string
  updatedAt: string
  revision: number
}

export interface CreateSideNoteInput {
  parentSessionId: string
  clientRequestId: string
  anchor: SideNoteAnchor
  title?: string
  mode?: ContextMode
}

export interface SideNoteRepository {
  insert(note: SideNote): Promise<SideNote>
  findById(id: string): Promise<SideNote | null>
  findByRequest(parentSessionId: string, clientRequestId: string): Promise<SideNote | null>
  listByParent(parentSessionId: string): Promise<SideNote[]>
  update(note: SideNote, expectedRevision: number): Promise<boolean>
}
