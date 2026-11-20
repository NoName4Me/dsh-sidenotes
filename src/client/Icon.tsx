import type { ReactNode } from 'react'
import { IconBranchOutlineRegular, IconCopyOutlineRegular, IconCheckOutlineRegular, IconSearchOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'

export type SideChatGlyph = 'back' | 'send' | 'quote' | 'locate' | 'stop' | 'archive' | 'promote' | 'restore' | 'sparkle' | 'search' | 'copy' | 'check' | 'branch' | 'list'

export function SideChatIcon({ name }: { name: SideChatGlyph }): ReactNode {
  if (name === 'copy') return <IconCopyOutlineRegular />
  if (name === 'check') return <IconCheckOutlineRegular />
  if (name === 'search') return <IconSearchOutlineRegular />
  if (name === 'branch') return <IconBranchOutlineRegular />
  const shared = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<Exclude<SideChatGlyph, 'copy'|'check'|'search'|'branch'>, ReactNode> = {
    back: <path d="m15 18-6-6 6-6M9 12h12" />,
    send: <><path d="M4 12 20 4l-6 16-2-7-8-1Z" /><path d="m12 13 8-9" /></>,
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
