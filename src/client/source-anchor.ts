/** DOM locator for DSH's already-rendered transcript, never alters its text. */
export interface SourceLocation {
  readonly action: HTMLElement
  readonly row: HTMLElement
  readonly source: HTMLElement | null
}
export function locateSource(messageId: string): SourceLocation | null {
  const action = Array.from(document.querySelectorAll<HTMLElement>('[data-sidenotes-anchor]'))
    .find(element => element.dataset.sidenotesAnchor === messageId)
  if (!action) return null
  const row = action.closest<HTMLElement>('[data-chat-flow-kind]')
  if (!row) return null
  const inRow = row.querySelector<HTMLElement>('[data-text-interaction-source]')
  if (inRow) return { action, row, source: inRow }
  const turn = row.dataset.chatTurn
  const flow = row.closest<HTMLElement>('[data-chat-flow]')
  const candidates = Array.from(flow?.querySelectorAll<HTMLElement>('[data-text-interaction-source]') ?? [])
    .filter(element => element.closest<HTMLElement>('[data-chat-turn]')?.dataset.chatTurn === turn)
  return { action, row, source: candidates.at(-1) ?? null }
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
  // DSH projects Markdown's soft line breaks into spaces for selection text.
  // Fold whitespace for matching, but retain a map back to exact DOM offsets.
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
  const location = locateSource(messageId)
  if (!location) return 'not-loaded'
  const range = selectedText && location.source ? locateQuote(location.source, selectedText) : null
  if (selectedText && !range) return 'quote-not-found'
  const target = location.source ?? location.row
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ block: 'center', behavior: reduced ? 'instant' : 'smooth' })
  // A long answer can contain the quoted fragment far below its start.
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
      window.setTimeout(() => masks.forEach(mask => mask.remove()), 2350)
    } else {
      location.row.classList.remove('sc-jump-full')
      // Restarting the CSS animation after repeated clicks.
      void location.row.offsetWidth
      location.row.classList.add('sc-jump-full')
      window.setTimeout(() => location.row.classList.remove('sc-jump-full'), 2350)
    }
  }, reduced ? 50 : 600)
  return 'ok'
}
