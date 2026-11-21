import { Context, Service } from '@deepseek-ai/cordis'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-workspace'
import { DshSideChatAccess } from './access.ts'
import { DshSideSessionAdapter } from './dsh-session-adapter.ts'
import { OfficialDshRuntimeBridge } from './dsh-runtime-bridge.ts'
import { DshHistoryReader } from './history.ts'
import { SideChatRpcRouter } from './rpc.ts'
import { registerSideChatWebRoute, type AuthenticatedWebServer } from './secured-route.ts'
import { createSideChatHostRuntime } from './runtime.ts'

export const name = 'dsh-sidechat'

/** Ensure that the Host has persistence, Agent Factory and Connection ready. */
export const inject = [
  'agents', 'agentDefaultModel', 'sessionQuery', 'sessionPersistence',
  'workspaceRegistry', 'tools', 'connection', 'webServer',
]

declare module '@deepseek-ai/cordis' {
  interface Context {
    sidechat: SideChatService
  }
}

/**
 * Runtime mounts an authenticated, owner-only logical RPC channel through the
 * official Connection service. No browser-callable unauthenticated HTTP route
 * is created.
 */
export class SideChatService extends Service {
  private readonly adapter: DshSideSessionAdapter
  private readonly router: SideChatRpcRouter

  constructor(ctx: Context) {
    super(ctx, 'sidechat')
    const runtime = new OfficialDshRuntimeBridge(ctx)
    this.adapter = new DshSideSessionAdapter(runtime)
    const coordinator = createSideChatHostRuntime(
      dshHomePath('state', 'sidechat.json'),
      new DshSideChatAccess(ctx),
      this.adapter,
    )
    const history = new DshHistoryReader({
      observe: id => runtime.observe(id),
      isRunning: id => ctx.agents.get(SessionId(id))?.status === 'running',
    })
    this.router = new SideChatRpcRouter(coordinator, history)
    // DSH WebServer owns authentication, Host/Origin policy and route lifetime.
    // A direct authenticated route avoids version-sensitive Connection registry
    // contextual ownership while preserving its wire-compatible RPC envelope.
    ctx.inject(['webServer'], (scope) => {
      const server = scope.get('webServer') as unknown as AuthenticatedWebServer
      scope.effect(() => registerSideChatWebRoute(server, this.router, req => {
        const result = scope.connection.admit({
          headers: req.headers,
        })
        return 'peer' in result ? result.peer : undefined
      }),
        'sidechat: authenticated Web RPC')
      console.info('[dsh-sidechat] authenticated Web RPC mounted')
    })
    ctx.effect(() => async () => {
      await this.adapter.dispose()
    }, 'sidechat: child Agent lifetime')
  }
}

export function apply(ctx: Context): void {
  new SideChatService(ctx)
}
