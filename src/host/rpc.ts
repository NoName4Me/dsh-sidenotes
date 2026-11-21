import { SideChatError } from '../domain/errors.ts'
import type { SideChat, CreateSideChatInput } from '../domain/types.ts'
import type { SideChatCoordinator } from './coordinator.ts'

/** This route is carried exclusively by DSH's authenticated Connection RPC. */
export { SIDECHAT_CHANNEL } from '../shared/channel.ts'

export interface AuthenticatedPeer {
  readonly principal: { readonly kind: string }
}
export type SideRpcResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string; readonly details: object } }
export interface HistoryItem {
  readonly messageId: string
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly seq: number
}
export interface SideChatHistory {
  readonly childSessionId: string
  readonly items: readonly HistoryItem[]
  readonly busy: boolean
}
export interface HistoryReader {
  read(note: SideChat): Promise<SideChatHistory>
}

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new SideChatError('INVALID_INPUT', 'JSON object expected')
  }
  return input as Record<string, unknown>
}
function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256) {
    throw new SideChatError('INVALID_INPUT', label + ' must be a nonempty string')
  }
  return value
}
function optionalBoolean(value: unknown, label: string): boolean {
  if (value === undefined) return false
  if (typeof value !== 'boolean') throw new SideChatError('INVALID_INPUT', label + ' must be boolean')
  return value
}
function failure(code: string, message: string): SideRpcResult {
  return { ok: false, error: { code, message, details: {} } }
}

/**
 * Owner-only API, built atop Connection's authenticated peer. No source or
 * parent text is logged. The coordinator still validates each parent, note
 * and anchor rather than trusting the browser payload.
 */
export class SideChatRpcRouter {
  private readonly notes: SideChatCoordinator
  private readonly history: HistoryReader

  constructor(notes: SideChatCoordinator, history: HistoryReader) {
    this.notes = notes
    this.history = history
  }

  async handle(peer: AuthenticatedPeer, endpoint: string, payload: unknown): Promise<SideRpcResult> {
    if (peer.principal.kind !== 'owner') {
      return failure('sidechat/denied', 'SideChat is available to the Host owner only')
    }
    try {
      const input = object(payload)
      const parentId = id(input.parentSessionId, 'parentSessionId')
      switch (endpoint) {
        case 'list':
          return { ok: true, value: await this.notes.list(parentId, optionalBoolean(input.includeArchived, 'includeArchived')) }
        case 'create':
          return { ok: true, value: await this.notes.create(input as unknown as CreateSideChatInput) }
        case 'get':
          return { ok: true, value: await this.notes.get(parentId, id(input.noteId, 'noteId')) }
        case 'history': {
          const note = await this.notes.get(parentId, id(input.noteId, 'noteId'))
          return { ok: true, value: await this.history.read(note) }
        }
        case 'followup': {
          if (typeof input.text !== 'string') throw new SideChatError('INVALID_INPUT', 'text must be string')
          await this.notes.followup(parentId, id(input.noteId, 'noteId'), input.text)
          return { ok: true, value: { accepted: true } }
        }
        case 'cancel':
          await this.notes.cancel(parentId, id(input.noteId, 'noteId'))
          return { ok: true, value: { cancelled: true } }
        case 'archive':
          return { ok: true, value: await this.notes.archive(parentId, id(input.noteId, 'noteId')) }
        case 'restore':
          return { ok: true, value: await this.notes.restore(parentId, id(input.noteId, 'noteId')) }
        case 'promote':
          return { ok: true, value: await this.notes.promote(parentId, id(input.noteId, 'noteId')) }
        default:
          return failure('sidechat/not-found', 'Unknown SideChat operation')
      }
    } catch (error) {
      if (error instanceof SideChatError) {
        return failure('sidechat/' + error.code.toLowerCase().replaceAll('_', '-'), error.message)
      }
      // Do not surface model prompts, local file paths, tokens or stack traces.
      return failure('sidechat/operation-failed', 'SideChat Host operation failed')
    }
  }
}
