import { SideNoteError } from './errors.ts'
import type { CreateSideNoteInput, SideNoteAnchor } from './types.ts'

const MAX_TITLE = 120
const MAX_QUOTE = 8_000

export function requiredId(value: unknown, name: string, maxLength = 256): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > maxLength ||
    /[\u0000-\u001f]/u.test(value)
  ) {
    throw new SideNoteError(
      'INVALID_INPUT',
      name + ' must be a nonempty string of at most ' + maxLength + ' characters',
    )
  }
  return value
}

export function normalizeAnchor(input: SideNoteAnchor): SideNoteAnchor {
  if (!input || typeof input !== 'object') {
    throw new SideNoteError('INVALID_INPUT', 'anchor is required')
  }
  const messageId = requiredId(input.messageId, 'anchor.messageId')
  if (input.selectedText !== undefined && typeof input.selectedText !== 'string') {
    throw new SideNoteError('INVALID_INPUT', 'anchor.selectedText must be a string')
  }
  const selectedText = input.selectedText?.trim()
  if (selectedText && selectedText.length > MAX_QUOTE) {
    throw new SideNoteError('INVALID_INPUT', 'selection exceeds the allowed length')
  }
  const eventSeq = input.eventSeq
  if (eventSeq !== undefined && (!Number.isSafeInteger(eventSeq) || eventSeq < 0)) {
    throw new SideNoteError('INVALID_INPUT', 'anchor.eventSeq must be a nonnegative safe integer')
  }
  return {
    messageId,
    ...(eventSeq === undefined ? {} : { eventSeq }),
    ...(selectedText ? { selectedText } : {}),
  }
}

export function normalizeCreate(input: CreateSideNoteInput): Required<
  Pick<CreateSideNoteInput, 'parentSessionId' | 'clientRequestId' | 'anchor' | 'title' | 'mode'>
> {
  if (!input || typeof input !== 'object') {
    throw new SideNoteError('INVALID_INPUT', 'create request is required')
  }
  const parentSessionId = requiredId(input.parentSessionId, 'parentSessionId')
  const clientRequestId = requiredId(input.clientRequestId, 'clientRequestId', 128)
  const anchor = normalizeAnchor(input.anchor)
  const mode = input.mode ?? 'light'
  if (mode !== 'light' && mode !== 'fork') {
    throw new SideNoteError('INVALID_INPUT', 'invalid context mode')
  }
  if (input.title !== undefined && typeof input.title !== 'string') {
    throw new SideNoteError('INVALID_INPUT', 'title must be a string')
  }
  const title = (
    input.title?.trim() ||
    anchor.selectedText?.split(/\r?\n/u)[0]?.trim() ||
    'New side chat'
  ).slice(0, MAX_TITLE)
  return { parentSessionId, clientRequestId, anchor, title, mode }
}
