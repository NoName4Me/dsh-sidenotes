import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { SideNoteError } from '../src/domain/errors.ts'
import { FileSideNoteRepository } from '../src/domain/file-repository.ts'
import { SideNoteService } from '../src/domain/service.ts'

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-sidenotes-'))
  dirs.push(dir)
  const path = join(dir, 'notes.json')
  const repository = new FileSideNoteRepository(path)
  const service = new SideNoteService(repository, { idFactory: () => 'n1' })
  return { path, repository, service }
}

describe('FileSideNoteRepository', () => {
  it('persists note relationships and status across restart', async () => {
    const { path, service } = await fixture()
    const note = await service.create({
      parentSessionId: 'main',
      clientRequestId: 'req',
      anchor: { messageId: 'm1' },
    })
    await service.bindSession('main', note.id, 'child')
    await service.archive('main', note.id)
    const restarted = new SideNoteService(new FileSideNoteRepository(path))
    const loaded = await restarted.get('main', note.id)
    assert.equal(loaded.status, 'archived')
    assert.equal(loaded.childSessionId, 'child')
    assert.equal(loaded.revision, 3)
    assert.equal(JSON.parse(await readFile(path, 'utf8')).version, 1)
  })

  it('serializes concurrent idempotent inserts into a single note', async () => {
    const { service } = await fixture()
    const request = {
      parentSessionId: 'main',
      clientRequestId: 'req',
      anchor: { messageId: 'm1' },
    }
    const [a, b] = await Promise.all([service.create(request), service.create(request)])
    assert.equal(a.id, b.id)
    assert.equal((await service.list('main')).length, 1)
  })

  it('fails loudly on incompatible storage instead of silently discarding data', async () => {
    const { path } = await fixture()
    await writeFile(path, JSON.stringify({ version: 99, notes: [] }))
    const repository = new FileSideNoteRepository(path)
    await assert.rejects(
      repository.listByParent('main'),
      error => error instanceof SideNoteError && error.code === 'INVALID_STATE',
    )
  })
})
