import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-sidenotes'

/**
 * Host plugin entry point. Domain state and Host APIs will be registered here
 * after the DSH session/agent adapter and permission policy are verified.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    console.info('[dsh-sidenotes] host loaded (development preview)')
    return () => console.info('[dsh-sidenotes] host unloaded')
  })
}
