#!/usr/bin/env node
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Publish under a GitHub namespace without changing existing Desktop installs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'dist', 'github-package')
const scoped = '@noname4me/dsh-sidenotes'
const read = name => readFileSync(join(root, name), 'utf8')
const pkg = JSON.parse(read('package.json'))
assert.equal(pkg.name, 'dsh-sidenotes')
assert.equal(pkg.version, JSON.parse(read('dsh.plugin.json')).version)
for (const file of ['lib/client.js', 'lib/index.mjs']) {
  assert.ok(existsSync(join(root, file)), 'missing built file: ' + file)
}
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
for (const file of ['lib', 'locale', 'icon.svg', 'LICENSE', 'dsh.plugin.json']) {
  cpSync(join(root, file), join(out, file), { recursive: true })
}
const patch = read('cordis.patch.yml')
assert.match(patch, /^\s+name: dsh-sidenotes\s*$/mu)
writeFileSync(join(out, 'cordis.patch.yml'),
  patch.replace(/^(\s+name:) dsh-sidenotes\s*$/mu, "$1 '" + scoped + "'"))
const clientPath = join(out, 'lib', 'client.js')
const code = readFileSync(clientPath, 'utf8')
assert.ok(code.includes("id: 'dsh-sidenotes'"))
assert.ok(code.includes('window.__ModuleLoader__.load('))
writeFileSync(clientPath, code.replace("id: 'dsh-sidenotes'", "id: '" + scoped + "'"))
pkg.name = scoped
pkg.private = false
pkg.publishConfig = { registry: 'https://npm.pkg.github.com', access: 'restricted' }
// The distribution is already built, so exclude source-only build scripts.
delete pkg.scripts
writeFileSync(join(out, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
console.log('Prepared ' + scoped + '@' + pkg.version)
