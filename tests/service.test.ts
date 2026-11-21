import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SideChatError } from '../src/domain/errors.ts'
import { MemorySideChatRepository } from '../src/domain/memory-repository.ts'
import { SideChatService } from '../src/domain/service.ts'

function setup() {
  const repository = new MemorySideChatRepository()
  let nextId = 0
  const service = new SideChatService(repository, {
    idFactory: () => 'note-' + ++nextId,
    now: () => new Date('2026-11-20T08:00:00.000Z'),
  })
  const input = {
    parentSessionId: 'parent-a',
    clientRequestId: 'request-1',
    anchor: { messageId: 'message-a', selectedText: 'Event sourcing' },
  }
  return { repository, service, input }
}

async function rejectCode(operation: Promise<unknown>, code: string) {
  await assert.rejects(
    operation,
    error => error instanceof SideChatError && error.code === code,
  )
}

describe('SideChatService', () => {
  it('creates an anchored note and deduplicates the same request key', async () => {
    const { service, input } = setup()
    const first = await service.create(input)
    const again = await service.create(input)
    assert.equal(first.id, again.id)
    assert.equal(first.anchor.selectedText, 'Event sourcing')
    assert.equal(first.title, 'Event sourcing')
    assert.equal(first.childSessionId, null)
    assert.equal((await service.list('parent-a')).length, 1)
  })

  it('keeps parent boundaries and archive filtering', async () => {
    const { service, input } = setup()
    const note = await service.create(input)
    await rejectCode(service.get('parent-b', note.id), 'NOT_FOUND')
    await service.archive('parent-a', note.id)
    assert.equal((await service.list('parent-a')).length, 0)
    assert.equal((await service.list('parent-a', true)).length, 1)
    assert.equal((await service.restore('parent-a', note.id)).status, 'active')
    assert.equal((await service.list('parent-a')).length, 1)
  })

  it('binds child session once and promotes idempotently', async () => {
    const { service, input } = setup()
    const note = await service.create(input)
    await rejectCode(service.promote('parent-a', note.id, 'visible'), 'INVALID_STATE')
    const bound = await service.bindSession('parent-a', note.id, 'hidden-child')
    assert.equal(bound.childSessionId, 'hidden-child')
    assert.equal(
      (await service.bindSession('parent-a', note.id, 'hidden-child')).revision,
      bound.revision,
    )
    await rejectCode(service.bindSession('parent-a', note.id, 'other-child'), 'CONFLICT')
    const promoted = await service.promote('parent-a', note.id, 'visible')
    assert.equal(promoted.status, 'promoted')
    assert.equal(
      (await service.promote('parent-a', note.id, 'visible')).revision,
      promoted.revision,
    )
    await rejectCode(service.promote('parent-a', note.id, 'different'), 'CONFLICT')
    await rejectCode(service.archive('parent-a', note.id), 'INVALID_STATE')
  })

  it('rejects invalid selections and event sequence', async () => {
    const { service, input } = setup()
    await rejectCode(
      service.create({
        ...input,
        clientRequestId: 'x',
        anchor: { ...input.anchor, selectedText: 'x'.repeat(8001) },
      }),
      'INVALID_INPUT',
    )
    await rejectCode(
      service.create({
        ...input,
        clientRequestId: 'y',
        anchor: { ...input.anchor, eventSeq: -1 },
      }),
      'INVALID_INPUT',
    )
    await rejectCode(
      service.create({ ...input, clientRequestId: 'z', parentSessionId: '\n' }),
      'INVALID_INPUT',
    )
  })

  it('does not expose repository references to consumers', async () => {
    const { service, input, repository } = setup()
    const note = await service.create(input)
    note.anchor.selectedText = 'tampered'
    const persisted = await repository.findById(note.id)
    assert.equal(persisted?.anchor.selectedText, 'Event sourcing')
  })
})
