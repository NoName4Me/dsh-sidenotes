/**
 * Integration with published DSH services. All runtime imports here are
 * official DSH API surfaces; domain and coordinator tests use structural
 * ports without loading any DSH package.
 *
 * Target: DSH 0.2.2-rc.1 (compile/install smoke test pending).
 */
import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId, SessionSeq, SessionLogOffset } from '@deepseek-ai/dsh-session'
import { buildForkSeed } from '@deepseek-ai/dsh-session/fork'
import type { AgentHandle, AgentOptions } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-tools'
import type { ObservedEvent, ObservedSession, CreateSideAgent, DshRuntimeBridge, SideAgentHandle } from './dsh-session-adapter.ts'
import type { SessionEvent } from '@deepseek-ai/dsh-session'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'dsh-sidechat': { kind: 'dsh-sidechat'; form: 'notice'; summary: string }
  }
}

/** Real adapters deny *every* tool (including indirect PTC subcalls) by default. */
const READ_ONLY_DENIAL = 'SideChat: tool execution is disabled for read-only side conversations.'

function wrapAgent(handle: AgentHandle): SideAgentHandle {
  const { agent } = handle
  return {
    id: String(agent.id),
    followup: (text) => agent.followup(createUserMessage({
      content: [{ type: 'text', text }],
      source: { kind: 'user' },
    })),
    cancel: () => agent.cancel({ kind: 'user' }),
    whenIdle: () => agent.whenIdle(),
    dispose: () => handle.dispose(),
  }
}

export class OfficialDshRuntimeBridge implements DshRuntimeBridge {
  constructor(private readonly ctx: Context) {}

  async observe(sessionId: string): Promise<ObservedSession> {
    const observed = await this.ctx.sessionQuery.observeSession(SessionId(sessionId), {
      projectionMode: 'none',
    })
    const persistedEventCount = 'persistedEventCount' in observed
      && typeof observed.persistedEventCount === 'number'
      ? observed.persistedEventCount : undefined
    return {
      header: observed.header,
      events: observed.events as readonly ObservedEvent[],
      inheritedEventCount: Number(observed.inheritedEventCount),
      ...(persistedEventCount === undefined ? {} : { persistedEventCount }),
      release: () => observed[Symbol.dispose](),
    }
  }

  async create(options: CreateSideAgent): Promise<SideAgentHandle> {
    const sessionId = SessionId(options.sessionId)
    const fallback = this.ctx.agentDefaultModel.currentSelection()
    const sourceAgent = options.fork
      ? this.ctx.agents.get(SessionId(options.fork.parentSessionId))
      : undefined
    const current = sourceAgent?.model.current()
    const selected = current ?? fallback
    const agentOptions: AgentOptions = {
      provider: selected.provider, model: selected.model,
      ...(selected.reasoningEffort === undefined
        ? {} : { reasoningEffort: selected.reasoningEffort }),
    }
    const fork = options.fork
    const seed = fork === undefined
      ? undefined
      : buildForkSeed(fork.events as readonly SessionEvent[], SessionSeq(fork.eventCount - 1))
    const setup = (agentCtx: Context) => {
      // A scoped monotonic execution guard; model suggestions and a hidden UI
      // cannot turn this denial into permission. No read tools are allowlisted
      // until their side effects and nested dispatch have been audited.
      agentCtx.tools.guard(exec => String(exec.agent?.id ?? '') === options.sessionId
        ? READ_ONLY_DENIAL : undefined)
    }
    const created = await this.ctx.agents.create({
      sessionId,
      ...(seed === undefined ? {} : {
        seed,
        inheritedEventCount: SessionLogOffset(fork!.eventCount),
        parentSource: {
          sessionId: SessionId(fork!.parentSessionId),
          endSeq: SessionLogOffset(fork!.persistedCount),
        },
      }),
      meta: {
        ...(options.cwd ? { cwd: options.cwd } : {}),
        ...(fork === undefined ? {} : { isSeeded: true }),
      },
      agentOptions,
      setup,
    })
    try {
      if (options.initialContext) {
        created.agent.inject(createUserMessage({
          content: [{ type: 'text', text: options.initialContext }],
          source: {
            kind: 'dsh-sidechat', form: 'notice', summary: 'SideChat isolated context',
          },
        }))
      }
      return wrapAgent(created)
    } catch (error) {
      await created.dispose()
      throw error
    }
  }

  async resume(sessionId: string): Promise<SideAgentHandle> {
    const id = SessionId(sessionId)
    // Reapply the same tool boundary after the saved Agent is loaded.
    const handle = await this.ctx.agents.resume({
      resumeSessionId: id,
      setup: (agentCtx: Context) => {
        agentCtx.tools.guard(exec => String(exec.agent?.id ?? '') === sessionId
          ? READ_ONLY_DENIAL : undefined)
      },
    })
    return wrapAgent(handle)
  }

  archive(sessionId: string): Promise<void> {
    return this.ctx.workspaceRegistry.archiveSession(SessionId(sessionId))
  }

  unarchive(sessionId: string): Promise<void> {
    return this.ctx.workspaceRegistry.unarchiveSession(SessionId(sessionId))
  }

  isNotFound(error: unknown): boolean {
    return !!error && typeof error === 'object' &&
      'code' in error && error.code === 'SESSION_QUERY_SESSION_NOT_FOUND'
  }
}
