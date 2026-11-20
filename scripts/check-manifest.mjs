import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = name => JSON.parse(readFileSync(join(root, name), 'utf8'))
const pkg = readJson('package.json')
const manifest = readJson('dsh.plugin.json')
const patchPath = join(root, pkg.dsh?.bundle?.patch ?? '')

assert.equal(pkg.name, 'dsh-sidenotes')
assert.equal(manifest.id, 'dsh-external/' + pkg.name)
assert.equal(pkg.version, manifest.version)
assert.equal(pkg.main, manifest.main)
assert.equal(manifest.client?.main, pkg.exports?.['./client'], 'client entry must be declared')
assert.equal(pkg.private, true, 'do not publish incomplete plugin')
assert.match(manifest.engines.dsh, /^>=\d+\.\d+\.\d+/u)
assert.equal(pkg.dsh?.client?.platform, 'web')
assert.ok(existsSync(patchPath), 'bundle patch must exist')
const patch = readFileSync(patchPath, 'utf8')
assert.ok(patch.includes('name: ' + pkg.name), 'patch must load the package')
console.log('SideNotes manifest checks passed')
