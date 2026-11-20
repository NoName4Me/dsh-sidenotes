import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-sidenotes-client'

/** Client entry point. UI Slot registrations will be added after API validation. */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    console.info('[dsh-sidenotes] client loaded (development preview)')
    return () => console.info('[dsh-sidenotes] client unloaded')
  })
}
