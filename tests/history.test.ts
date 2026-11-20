import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DshHistoryReader } from '../src/host/history.ts'
import type { ObservedSession } from '../src/host/dsh-session-adapter.ts'
import type { SideNote } from '../src/domain/types.ts'

const note: SideNote = {
  id: 'n1', clientRequestId: 'request', parentSessionId: 'main',
  childSessionId: 'child', title: 'Test', mode: 'fork', status: 'active',
  anchor: { messageId: 'main-msg' }, createdAt: '', updatedAt: '', revision: 1,
}

describe('DshHistoryReader', () => {
  it('shows only child-authored messages, not inherited main messages', async () => {
    let released = 0
    const observed: ObservedSession = {
      header: { id: 'child' },
      inheritedEventCount: 2,
      events: [
        { type: 'assistant/message', seq: 0, data: { message: { id: 'main-msg', content: [{ type: 'text', text: 'Main conversation' }] } } },
        { type: 'turn/end', seq: 1, data: {} },
        { type: 'user/message', seq: 2, data: { id: 'side-user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Side question' }] } },
        { type: 'assistant/message', seq: 3, data: { message: { id: 'side-answer', content: [{ type: 'text', text: 'Side answer' }] } } },
      ],
      release() { released++ },
    }
    const reader = new DshHistoryReader({
      observe: async () => observed,
      isRunning: () => false,
    })
    const result = await reader.read(note)
    assert.deepEqual(result.items.map(item => item.text), ['Side question', 'Side answer'])
    assert.equal(released, 1)
  })
})
