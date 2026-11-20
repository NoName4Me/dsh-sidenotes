import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(join(root, 'dsh.plugin.json'), 'utf8'))

for (const entry of [pkg.main, manifest.main, pkg.exports['.'], pkg.exports['./client'], manifest.client.main]) {
  assert.equal(typeof entry, 'string')
  assert.ok(entry.startsWith('./lib/'), 'plugin entry must resolve under lib/')
  assert.ok(existsSync(join(root, entry)), 'missing plugin output: ' + entry)
}
assert.equal(pkg.main, manifest.main)
assert.equal(pkg.exports['./client'], manifest.client.main)
console.log('SideNotes bundles and published entry points are consistent')
