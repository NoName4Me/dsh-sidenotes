import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SideChatError } from '../src/domain/errors.ts'
import { MemorySideChatRepository } from '../src/domain/memory-repository.ts'
import { SideChatService } from '../src/domain/service.ts'
import { SideChatCoordinator } from '../src/host/coordinator.ts'
import type { SideChat, SideChatAnchor } from '../src/domain/types.ts'

function fixture() {
  let id = 0
  let failures = 0
  let ensures = 0
  let promotions = 0
  const calls: string[] = []
  const notes = new SideChatService(new MemorySideChatRepository(), {
    idFactory: () => 'note-' + ++id,
  })
  const coordinator = new SideChatCoordinator(
    notes,
    {
      async assertParentAccess(parentSessionId: string) {
        if (parentSessionId !== 'allowed-parent') throw new Error('access denied')
      },
      async assertAnchorBelongsToParent(_parentSessionId: string, anchor: SideChatAnchor) {
        if (anchor.messageId !== 'message-1') throw new Error('invalid anchor')
      },
    },
    {
      async ensure(note: SideChat, policy: { readOnly: true }) {
        assert.equal(policy.readOnly, true)
        ensures++
        if (failures-- > 0) throw new Error('temporary host failure')
        return { sessionId: 'child-' + note.id }
      },
      async followup(child, text) { calls.push('followup:' + child + ':' + text) },
      async cancel(child) { calls.push('cancel:' + child) },
      async promote(note) {
        promotions++
        return { sessionId: 'visible-' + note.id }
      },
    },
  )
  const input = {
    parentSessionId: 'allowed-parent',
    clientRequestId: 'request-1',
    anchor: { messageId: 'message-1', selectedText: 'Cordis' },
  }
  return {
    coordinator, input, calls,
    failOnce() { failures = 1 },
    ensured() { return ensures },
    promoted() { return promotions },
  }
}

async function rejectCode(p: Promise<unknown>, code: string) {
  await assert.rejects(p, e => e instanceof SideChatError && e.code === code)
}

describe('SideChatCoordinator', () => {
  it('creates a child through the narrow port with a read-only policy request', async () => {
    const f = fixture()
    const created = await f.coordinator.create(f.input)
    assert.equal(created.childSessionId, 'child-note-1')
    assert.equal(f.ensured(), 1)
  })

  it('coalesces concurrent repeated creates and does not create another child', async () => {
    const f = fixture()
    const [a, b] = await Promise.all([
      f.coordinator.create(f.input),
      f.coordinator.create(f.input),
    ])
    assert.equal(a.id, b.id)
    assert.equal(f.ensured(), 1)
    const c = await f.coordinator.create(f.input)
    assert.equal(c.childSessionId, a.childSessionId)
    assert.equal(f.ensured(), 1)
  })

  it('recovers a pending metadata record after the adapter fails', async () => {
    const f = fixture()
    f.failOnce()
    await assert.rejects(f.coordinator.create(f.input), /temporary host failure/)
    const created = await f.coordinator.create(f.input)
    assert.equal(created.id, 'note-1')
    assert.equal(created.childSessionId, 'child-note-1')
    assert.equal(f.ensured(), 2)
  })

  it('does not allow an idempotency key to silently map to a new anchor', async () => {
    const f = fixture()
    await f.coordinator.create(f.input)
    await rejectCode(
      f.coordinator.create({ ...f.input, title: 'Different question' }),
      'CONFLICT',
    )
  })

  it('authorizes every operation and rejects an invalid parent or anchor', async () => {
    const f = fixture()
    await assert.rejects(
      f.coordinator.create({ ...f.input, parentSessionId: 'forbidden' }),
      /access denied/,
    )
    await assert.rejects(
      f.coordinator.create({ ...f.input, anchor: { messageId: 'forged' } }),
      /invalid anchor/,
    )
    const created = await f.coordinator.create(f.input)
    await assert.rejects(f.coordinator.get('forbidden', created.id), /access denied/)
    await rejectCode(f.coordinator.get('allowed-parent', 'missing'), 'NOT_FOUND')
  })

  it('only sends valid prompts to active notes and cancel targets the child', async () => {
    const f = fixture()
    const note = await f.coordinator.create(f.input)
    await f.coordinator.followup('allowed-parent', note.id, 'Explain the event log')
    assert.equal(f.ensured(), 2, 'followup must revalidate and resume the persisted Agent')
    await f.coordinator.cancel('allowed-parent', note.id)
    assert.equal(f.ensured(), 3, 'cancel also loads the Agent after a restart')
    assert.deepEqual(f.calls, [
      'followup:child-note-1:Explain the event log',
      'cancel:child-note-1',
    ])
    await rejectCode(f.coordinator.followup('allowed-parent', note.id, ''), 'INVALID_INPUT')
    await f.coordinator.archive('allowed-parent', note.id)
    await rejectCode(f.coordinator.followup('allowed-parent', note.id, 'ignored'), 'INVALID_STATE')
    await f.coordinator.restore('allowed-parent', note.id)
    await f.coordinator.followup('allowed-parent', note.id, 'continued')
    assert.equal(f.calls.at(-1), 'followup:child-note-1:continued')
  })

  it('promotes idempotently, independently of sending content to the parent', async () => {
    const f = fixture()
    const note = await f.coordinator.create(f.input)
    const [a, b] = await Promise.all([
      f.coordinator.promote('allowed-parent', note.id),
      f.coordinator.promote('allowed-parent', note.id),
    ])
    assert.equal(a.promotedSessionId, 'visible-note-1')
    assert.equal(b.promotedSessionId, a.promotedSessionId)
    assert.equal(f.promoted(), 1)
    await rejectCode(
      f.coordinator.followup('allowed-parent', note.id, 'should use visible session'),
      'INVALID_STATE',
    )
  })
})
