import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DshSideSessionAdapter } from '../src/host/dsh-session-adapter.ts'
import type { CreateSideAgent, DshRuntimeBridge, ObservedSession, SideAgentHandle } from '../src/host/dsh-session-adapter.ts'
import type { SideNote } from '../src/domain/types.ts'

function note(mode: 'fork' | 'light' = 'fork'): SideNote {
  return {
    id: 'n1', clientRequestId: 'r1', parentSessionId: 'parent',
    childSessionId: null, anchor: { messageId: 'm1', eventSeq: 1, selectedText: 'selected text' },
    title: 'Selected question', mode, status: 'active',
    createdAt: '', updatedAt: '', revision: 1,
  }
}
function fixture() {
  const calls: string[] = []
  const events = [
    { type: 'turn/start', seq: 0, data: { turn: 1 } },
    { type: 'assistant/message', seq: 1, data: { message: { id: 'm1' } } },
    { type: 'turn/end', seq: 2, data: { turn: 1 } },
    { type: 'turn/start', seq: 3, data: { turn: 2 } },
    { type: 'assistant/message', seq: 4, data: { message: { id: 'm2' } } },
    { type: 'turn/end', seq: 5, data: { turn: 2 } },
  ]
  const stored = new Set<string>(['parent'])
  let lastCreate: CreateSideAgent | undefined
  let idle = Promise.resolve()
  let resolved: (() => void) | undefined
  const agent: SideAgentHandle = {
    id: 'session-sidenotes-n1',
    followup: text => calls.push('followup:' + text),
    cancel: () => calls.push('cancel'),
    whenIdle: () => idle,
    dispose: async () => { calls.push('dispose') },
  }
  const runtime: DshRuntimeBridge = {
    async observe(id) {
      if (!stored.has(id)) throw Object.assign(new Error('missing'), { code: 'SESSION_QUERY_SESSION_NOT_FOUND' })
      const observed: ObservedSession = {
        header: { id, cwd: '/workspace' },
        events: id === 'parent' ? events : [],
        release() { calls.push('release:' + id) },
      }
      return observed
    },
    async create(options) {
      lastCreate = options
      calls.push('create:' + options.sessionId)
      stored.add(options.sessionId)
      return agent
    },
    async resume(id) {
      calls.push('resume:' + id)
      return agent
    },
    async archive(id) { calls.push('archive:' + id) },
    async unarchive(id) { calls.push('unarchive:' + id) },
    isNotFound(error) {
      return !!error && typeof error === 'object' &&
        'code' in error && error.code === 'SESSION_QUERY_SESSION_NOT_FOUND'
    },
  }
  return {
    runtime, calls, stored, adapter: new DshSideSessionAdapter(runtime),
    createOptions() { return lastCreate },
    pause() {
      idle = new Promise<void>(resolve => { resolved = resolve })
    },
    finish() { resolved?.() },
  }
}
const sid = 'session-sidenotes-n1'
const flush = async () => new Promise(resolve => setImmediate(resolve))

describe('DshSideSessionAdapter', () => {
  it('creates a fork with the first completed turn after the anchor, not the latest turn', async () => {
    const f = fixture()
    assert.deepEqual(await f.adapter.ensure(note(), { readOnly: true }), { sessionId: sid })
    assert.deepEqual(f.createOptions()?.fork?.eventCount, 3)
    assert.deepEqual(f.createOptions()?.fork?.persistedCount, 3)
    assert.equal(f.createOptions()?.initialContext, undefined)
    assert.ok(f.calls.includes('archive:' + sid))
    assert.ok(f.calls.includes('release:parent'))
  })

  it('Light mode creates an independent Session and includes the bounded quote', async () => {
    const f = fixture()
    await f.adapter.ensure(note('light'), { readOnly: true })
    assert.equal(f.createOptions()?.fork, undefined)
    assert.match(f.createOptions()?.initialContext ?? '', /selected text/)
  })

  it('recovers the deterministic child id after metadata failed to bind', async () => {
    const f = fixture()
    f.stored.add(sid)
    await f.adapter.ensure(note(), { readOnly: true })
    assert.equal(f.calls.filter(x => x.startsWith('create:')).length, 0)
    assert.equal(f.calls.filter(x => x.startsWith('resume:')).length, 1)
  })

  it('unarchives for every turn and rearchives only after Agent idle', async () => {
    const f = fixture()
    await f.adapter.ensure(note(), { readOnly: true })
    f.pause()
    await Promise.all([f.adapter.followup(sid, 'one'), f.adapter.followup(sid, 'two')])
    assert.equal(f.calls.filter(x => x === 'unarchive:' + sid).length, 1)
    assert.deepEqual(f.calls.filter(x => x.startsWith('followup:')), ['followup:one', 'followup:two'])
    const archivedBefore = f.calls.filter(x => x === 'archive:' + sid).length
    assert.equal(archivedBefore, 1)
    f.finish()
    await f.adapter.dispose()
    assert.equal(f.calls.filter(x => x === 'archive:' + sid).length, 2)
  })

  it('promotes the same Session id and keeps it visible after a followup', async () => {
    const f = fixture()
    await f.adapter.ensure(note(), { readOnly: true })
    assert.deepEqual(await f.adapter.promote(note()), { sessionId: sid })
    await f.adapter.followup(sid, 'after promotion')
    await flush()
    assert.equal(f.calls.filter(x => x === 'archive:' + sid).length, 1)
    await f.adapter.dispose()
    assert.ok(f.calls.includes('dispose'))
  })

  it('never invents a child for a missing anchor or an unfinished turn', async () => {
    const f = fixture()
    await assert.rejects(
      f.adapter.ensure({ ...note(), anchor: { messageId: 'unknown' } }, { readOnly: true }),
      /anchor message does not exist/,
    )
    assert.equal(f.calls.filter(x => x.startsWith('create:')).length, 0)
  })

  it('rejects operations on another Session or a disposed adapter', async () => {
    const f = fixture()
    await assert.rejects(f.adapter.followup('session-elsewhere', 'no'), /not owned/)
    await f.adapter.ensure(note(), { readOnly: true })
    await f.adapter.dispose()
    await assert.rejects(f.adapter.cancel(sid), /disposed/)
  })
})
