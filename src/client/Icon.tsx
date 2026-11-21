import type { ReactNode } from 'react'
import { IconBranchOutlineRegular, IconCopyOutlineRegular, IconCheckOutlineRegular, IconSearchOutlineRegular, IconTriangleRightFillRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'

export type SideChatGlyph = 'back' | 'send' | 'quote' | 'locate' | 'stop' | 'archive' | 'promote' | 'restore' | 'sparkle' | 'search' | 'copy' | 'check' | 'branch' | 'side-chat' | 'list'

export function SideChatIcon({ name }: { name: SideChatGlyph }): ReactNode {
  if (name === 'copy') return <IconCopyOutlineRegular />
  if (name === 'check') return <IconCheckOutlineRegular />
  if (name === 'search') return <IconSearchOutlineRegular />
  if (name === 'branch') return <IconBranchOutlineRegular />
  if (name === 'send') return <IconTriangleRightFillRegular />
  if (name === 'side-chat') return (
    // Two overlapping bubbles, with the small conversation painted last and
    // fully occluding the main bubble, just like the Plugin Manager artwork.
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" fill="none"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 3.5H15a3.5 3.5 0 0 1 3.5 3.5v5a3.5 3.5 0 0 1-3.5 3.5h-5l-4 3v-3A3.5 3.5 0 0 1 2 12V7a3.5 3.5 0 0 1 3.5-3.5Z"
        stroke="currentColor" strokeWidth="1.75"/>
      <path d="M6.5 8h7" stroke="currentColor" strokeWidth="1.75"/>
      <path d="M14 13.5h6a3 3 0 0 1 3 3v2.4a3 3 0 0 1-3 3h-2l-2.3 1.7v-1.7H14a3 3 0 0 1-3-3v-2.4a3 3 0 0 1 3-3Z"
        fill="currentColor" stroke="var(--dsw-alias-bg-layer-1)" strokeWidth="1.45"/>
      <path d="M14.4 17.7h5" stroke="var(--dsw-alias-bg-layer-1)" strokeWidth="1.5"/>
    </svg>
  )
  const shared = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<Exclude<SideChatGlyph, 'copy'|'check'|'search'|'branch'|'send'|'side-chat'>, ReactNode> = {
    back: <path d="m15 18-6-6 6-6M9 12h12" />,
    quote: <><path d="M10 11H5V6h6v6l-4 5M20 11h-5V6h6v6l-4 5" /></>,
    locate: <><circle cx="12" cy="12" r="8" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /><circle cx="12" cy="12" r="2" /></>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    archive: <><rect x="4" y="4" width="16" height="5" rx="1" /><path d="M6 9v11h12V9M10 13h4" /></>,
    promote: <><path d="M12 16V3M7 8l5-5 5 5M5 16v4h14v-4" /></>,
    restore: <><path d="M4 12a8 8 0 1 0 2-5M4 4v5h5" /><path d="M12 8v5l3 2" /></>,
    sparkle: <><path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z" /></>,
    list: <><path d="M9 6h12M9 12h12M9 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  }
  return <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" {...shared}>{paths[name]}</svg>
}

export function SideChatIconButton({ label, icon, onClick, disabled, active }: {
  label: string
  icon: SideChatGlyph
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <Tooltip label={label} side="bottom">
      <button type="button" className="sc-icon-button" aria-label={label}
        aria-pressed={active || undefined}
        disabled={disabled} onClick={onClick}>
        <SideChatIcon name={icon} />
      </button>
    </Tooltip>
  )
}
