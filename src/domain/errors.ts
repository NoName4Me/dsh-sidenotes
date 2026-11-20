export type SideNoteErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'INVALID_STATE' | 'CONFLICT'

export class SideNoteError extends Error {
  readonly code: SideNoteErrorCode

  constructor(code: SideNoteErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'SideNoteError'
  }
}
