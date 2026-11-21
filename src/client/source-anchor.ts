/** DSH's action lives in a turn-tail row, while the reply body lives in
 * another assistant-step row. Never use the toolbar itself as a jump target.
 */
export interface SourceLocation {
  readonly action: HTMLElement
  /** The assistant response, not the turn-tail action row. */
  readonly row: HTMLElement
  readonly source: HTMLElement | null
}
function textOf(row: HTMLElement): string {
  const sources = row.querySelectorAll<HTMLElement>('[data-text-interaction-source]')
  return Array.from(sources).map(node => node.textContent?.trim() ?? '').filter(Boolean).join(' ')
}
export function locateSource(messageId: string, selectedText?: string): SourceLocation | null {
  const action = Array.from(document.querySelectorAll<HTMLElement>('[data-sidechat-anchor]'))
    .find(element => element.dataset.sidechatAnchor === messageId)
  if (!action) return null
  const tail = action.closest<HTMLElement>('[data-chat-turn]')
  if (!tail) return null
  const turn = tail.dataset.chatTurn
  if (turn === undefined) return null
  // A step group may add a nested [data-chat-flow]; use the outer transcript
  // to find sibling assistant-step rows of the same turn.
  let flow = tail.closest<HTMLElement>('[data-chat-flow]')
  while (flow?.parentElement?.closest<HTMLElement>('[data-chat-flow]')) {
    flow = flow.parentElement.closest<HTMLElement>('[data-chat-flow]') ?? flow
  }
  if (!flow) return null
  const replies = Array.from(flow.querySelectorAll<HTMLElement>('[data-chat-flow-kind="assistant-step"]'))
    .filter(node => node.dataset.chatTurn === turn && node.dataset.chatGroupPart !== 'reasoning')
  if (replies.length === 0) return null
  // The tail follows the reply; prefer the last response if the turn contains
  // intermediate assistant steps.
  let row = replies.at(-1)!
  if (selectedText) {
    row = replies.find(candidate =>
      Array.from(candidate.querySelectorAll<HTMLElement>('[data-text-interaction-source]'))
        .some(source => locateQuote(source, selectedText) !== null)) ?? row
  }
  const sources = Array.from(row.querySelectorAll<HTMLElement>('[data-text-interaction-source]'))
  const source = selectedText
    ? sources.find(node => locateQuote(node, selectedText)) ?? null
    : sources.at(-1) ?? null
  return { action, row, source }
}
export function sourceExcerpt(messageId: string): string | undefined {
  const location = locateSource(messageId)
  if (!location) return undefined
  const text = textOf(location.row).replace(/\s+/gu, ' ').trim()
  return text.length > 0 ? text.slice(0, 110) : undefined
}

/** Text nodes may be separated by Markdown inline markup; match across them. */
export function locateQuote(source: HTMLElement, original: string): Range | null {
  const quote = original.trim()
  if (!quote) return null
  const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  const offsets: number[] = []
  let text = ''
  let node: Node | null
  while ((node = walker.nextNode()) !== null) {
    const parent = node.parentElement
    if (parent?.closest('button,script,style,[aria-hidden="true"]')) continue
    offsets.push(text.length)
    nodes.push(node as Text)
    text += node.textContent ?? ''
  }
  const positions: number[] = []
  let folded = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (/\s/u.test(char)) {
      if (folded.length === 0 || folded.endsWith(' ')) continue
      folded += ' '
    } else folded += char
    positions.push(i)
  }
  const expected = quote.replace(/\s+/gu, ' ')
  const index = folded.indexOf(expected)
  if (index < 0) return null
  const first = positions[index]
  const last = positions[index + expected.length - 1]
  if (first === undefined || last === undefined) return null
  const start = nodes.findIndex((n, i) =>
    first >= offsets[i]! && first < offsets[i]! + (n.textContent?.length ?? 0))
  const end = nodes.findIndex((n, i) =>
    last >= offsets[i]! && last < offsets[i]! + (n.textContent?.length ?? 0))
  if (start < 0 || end < 0) return null
  const range = document.createRange()
  range.setStart(nodes[start]!, first - offsets[start]!)
  range.setEnd(nodes[end]!, last - offsets[end]! + 1)
  return range
}
export function jumpToSource(
  messageId: string, selectedText?: string,
): 'ok' | 'not-loaded' | 'quote-not-found' {
  const location = locateSource(messageId, selectedText)
  if (!location) return 'not-loaded'
  const range = selectedText && location.source ? locateQuote(location.source, selectedText) : null
  if (selectedText && !range) return 'quote-not-found'
  const target = location.row
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ block: 'center', behavior: reduced ? 'instant' : 'smooth' })
  if (range) {
    window.setTimeout(() => {
      const scroll = target.closest<HTMLElement>('[data-conversation-scroll]') ??
        target.closest<HTMLElement>('[data-chat-flow]')?.parentElement
      if (!scroll) return
      const rect = range.getBoundingClientRect()
      const frame = scroll.getBoundingClientRect()
      const delta = rect.top - frame.top - frame.height / 2
      if (Math.abs(delta) > 20) scroll.scrollBy({ top: delta, behavior: reduced ? 'instant' : 'smooth' })
    }, reduced ? 0 : 180)
  }
  window.setTimeout(() => {
    if (!target.isConnected) return
    if (range) {
      const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0)
      const masks = rects.map(rect => {
        const marker = document.createElement('div')
        marker.className = 'sc-jump-range'
        marker.style.left = (rect.left - 2) + 'px'
        marker.style.top = (rect.top - 2) + 'px'
        marker.style.width = (rect.width + 4) + 'px'
        marker.style.height = (rect.height + 4) + 'px'
        document.body.append(marker)
        return marker
      })
      window.setTimeout(() => masks.forEach(mask => mask.remove()), 2400)
    } else {
      // Flash the *full reply body*, never its closing button toolbar.
      target.classList.remove('sc-jump-full')
      void target.offsetWidth
      target.classList.add('sc-jump-full')
      window.setTimeout(() => target.classList.remove('sc-jump-full'), 2400)
    }
  }, reduced ? 30 : 540)
  return 'ok'
}
