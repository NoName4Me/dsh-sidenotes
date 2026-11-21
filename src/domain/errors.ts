export type SideChatErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'INVALID_STATE' | 'CONFLICT'

export class SideChatError extends Error {
  readonly code: SideChatErrorCode

  constructor(code: SideChatErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'SideChatError'
  }
}
