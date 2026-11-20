import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MemorySideNoteRepository } from '../src/domain/memory-repository.ts'
import { SideNoteService } from '../src/domain/service.ts'
import { SideNoteCoordinator } from '../src/host/coordinator.ts'
import { SideNotesRpcRouter } from '../src/host/rpc.ts'
import { DshHistoryReader } from '../src/host/history.ts'
import type { ObservedSession } from '../src/host/dsh-session-adapter.ts'

function fixture() {
  const calls: string[] = []
  const coordinator = new SideNoteCoordinator(
    new SideNoteService(new MemorySideNoteRepository(), { idFactory: () => 'n1' }),
    {
      async assertParentAccess(parent) { if (parent !== 'p1') throw new Error('bad parent') },
      async assertAnchorBelongsToParent(_parent, anchor) {
        if (anchor.messageId !== 'm1') throw new Error('bad anchor')
      },
    },
    {
      async ensure() { return { sessionId: 'c1' } },
      async followup(_child, text) { calls.push('followup:' + text) },
      async cancel() { calls.push('cancel') },
      async promote() { return { sessionId: 'c1' } },
    },
  )
  const reader = new DshHistoryReader({
    async observe(id) {
      assert.equal(id, 'c1')
      const session: ObservedSession = {
        header: { id },
        events: [
          { seq: 0, type: 'user/message', data: { id: 'injected', content: [{ type: 'text', text: 'internal context' }], source: { kind: 'dsh-sidenotes' } } },
          { seq: 1, type: 'user/message', data: { id: 'u1', content: [{ type: 'text', text: 'Question?' }], source: { kind: 'user' } } },
          { seq: 2, type: 'assistant/message', data: { message: { id: 'a1', content: [{ type: 'text', text: 'Answer.' }] } } },
        ],
        release() { calls.push('release') },
      }
      return session
    },
    isRunning: () => false,
  })
  const router = new SideNotesRpcRouter(coordinator, reader)
  const owner = { principal: { kind: 'owner' } }
  return { router, owner, calls }
}

describe('authenticated SideNotes RPC router', () => {
  it('denies non-owner peers before parsing the payload', async () => {
    const f = fixture()
    assert.deepEqual(
      await f.router.handle({ principal: { kind: 'guest' } }, 'list', null),
      { ok: false, error: { code: 'sidenotes/denied', message: 'SideNotes is available to the Host owner only', details: {} } },
    )
  })

  it('creates a note and keeps the parent session separate', async () => {
    const f = fixture()
    const result = await f.router.handle(f.owner, 'create', {
      parentSessionId: 'p1', clientRequestId: 'r1', anchor: { messageId: 'm1' },
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal((result.value as { childSessionId: string }).childSessionId, 'c1')
    assert.equal((await f.router.handle(f.owner, 'list', { parentSessionId: 'p1' })).ok, true)
    assert.equal(f.calls.length, 0)
  })

  it('returns only side Session user/assistant text, never injected context', async () => {
    const f = fixture()
    await f.router.handle(f.owner, 'create', {
      parentSessionId: 'p1', clientRequestId: 'r1', anchor: { messageId: 'm1' },
    })
    const r = await f.router.handle(f.owner, 'history', { parentSessionId: 'p1', noteId: 'n1' })
    assert.equal(r.ok, true)
    if (!r.ok) return
    const history = r.value as { items: { text: string }[] }
    assert.deepEqual(history.items.map(x => x.text), ['Question?', 'Answer.'])
    assert.ok(f.calls.includes('release'))
  })

  it('checks input type and denies access to another parent', async () => {
    const f = fixture()
    const a = await f.router.handle(f.owner, 'create', {
      parentSessionId: 'p1', clientRequestId: 'r1', anchor: { messageId: 'm1' },
    })
    assert.equal(a.ok, true)
    const invalid = await f.router.handle(f.owner, 'followup', { parentSessionId: 'p1', noteId: 'n1', text: 42 })
    assert.equal(invalid.ok, false)
    const forbidden = await f.router.handle(f.owner, 'history', { parentSessionId: 'not-p1', noteId: 'n1' })
    assert.equal(forbidden.ok, false)
  })
})
