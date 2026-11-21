export type ContextMode = 'light' | 'fork'
export type SideChatStatus = 'active' | 'archived' | 'promoted'

export interface SideChatAnchor {
  messageId: string
  eventSeq?: number
  selectedText?: string
}

export interface SideChat {
  id: string
  parentSessionId: string
  childSessionId: string | null
  clientRequestId: string
  anchor: SideChatAnchor
  title: string
  mode: ContextMode
  status: SideChatStatus
  promotedSessionId?: string
  createdAt: string
  updatedAt: string
  revision: number
}

export interface CreateSideChatInput {
  parentSessionId: string
  clientRequestId: string
  anchor: SideChatAnchor
  title?: string
  mode?: ContextMode
}

export interface SideChatRepository {
  insert(note: SideChat): Promise<SideChat>
  findById(id: string): Promise<SideChat | null>
  findByRequest(parentSessionId: string, clientRequestId: string): Promise<SideChat | null>
  listByParent(parentSessionId: string): Promise<SideChat[]>
  update(note: SideChat, expectedRevision: number): Promise<boolean>
}
