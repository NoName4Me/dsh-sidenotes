import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { OfficialDshRuntimeBridge } from '../src/host/dsh-runtime-bridge.ts'

function mockContext() {
  const guards = []
  const calls = []
  const injected = []
  let handle
  const agent = {
    id: 'session-sidechat-test',
    model: { current: () => undefined },
    followup(message) { calls.push(['followup', message]) },
    cancel(reason) { calls.push(['cancel', reason]) },
    whenIdle: async () => {},
    inject(message) { injected.push(message) },
  }
  const context = {
    agentDefaultModel: { currentSelection: () => ({ provider: 'test-provider', model: 'test-model' }) },
    agents: {
      get: () => undefined,
      async create(options) {
        calls.push(['create', options])
        options.setup({ tools: { guard(fn) { guards.push(fn) } } })
        handle = { agent, async dispose() { calls.push(['dispose']) } }
        return handle
      },
      async resume(options) {
        calls.push(['resume', options])
        options.setup({ tools: { guard(fn) { guards.push(fn) } } })
        return { agent, async dispose() { calls.push(['dispose']) } }
      },
    },
    workspaceRegistry: {
      async archiveSession(id) { calls.push(['archive', id]) },
      async unarchiveSession(id) { calls.push(['unarchive', id]) },
    },
  }
  return { context, guards, calls, injected }
}

describe('OfficialDshRuntimeBridge integration contract', () => {
  it('uses real DSH message constructors and denies tools for the side Agent', async () => {
    const f = mockContext()
    const bridge = new OfficialDshRuntimeBridge(f.context)
    const owned = await bridge.create({
      sessionId: 'session-sidechat-test', initialContext: 'Explain Cordis',
    })
    assert.equal(f.guards.length, 1)
    assert.match(f.guards[0]({ agent: { id: 'session-sidechat-test' }, name: 'bash' }), /disabled/)
    assert.match(f.guards[0]({ agent: { id: 'session-sidechat-test' }, name: 'run_code' }), /disabled/)
    assert.equal(f.guards[0]({ agent: { id: 'another-agent' }, name: 'bash' }), undefined)
    assert.equal(f.injected.length, 1)
    assert.equal(f.injected[0].source.kind, 'dsh-sidechat')
    owned.followup('Another question')
    assert.equal(f.calls.at(-1)[1].role, 'user')
    await owned.dispose()
    assert.equal(f.calls.at(-1)[0], 'dispose')
  })

  it('restores the same deny-all guard on resume', async () => {
    const f = mockContext()
    const bridge = new OfficialDshRuntimeBridge(f.context)
    await bridge.resume('session-sidechat-test')
    assert.equal(f.guards.length, 1)
    assert.match(f.guards[0]({ agent: { id: 'session-sidechat-test' }, name: 'write_file' }), /disabled/)
  })

  it('uses real typed Session IDs for archive and unarchive', async () => {
    const f = mockContext()
    const bridge = new OfficialDshRuntimeBridge(f.context)
    await bridge.archive('session-sidechat-test')
    await bridge.unarchive('session-sidechat-test')
    assert.deepEqual(f.calls.map(call => call[0]), ['archive', 'unarchive'])
  })
})
