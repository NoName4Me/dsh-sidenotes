# Instructions for coding agents

This repository implements **SideNotes**, a DeepSeek Harness Web plugin. Read these files before changing implementation:

1. [docs/design.md](docs/design.md) — product contract, context isolation and safety boundaries
2. [docs/development.md](docs/development.md) — engineering conventions and commit rules
3. [docs/roadmap.md](docs/roadmap.md) — milestone definitions and known unverified pieces

## Non-negotiable behavior

- Never let side-thread activity implicitly modify the parent Session's messages, context, files or tools.
- Promotion to a visible Session and bringing content back into the parent are independent user actions.
- Side threads are anchored to a source message; persist that anchor on the Host side.
- Read-only policy must be implemented in Host tool permissions. Prompt-only safeguards do not count.
- Use DSH's published Cordis plugin lifecycle, Session/Agent API and UI Slots; do not monkey-patch the host Chat UI or reach into private APIs without a documented compatibility adapter.
- Do not add a plain HTTP API unless its authentication and origin protections match the host's actual trust boundary.
- Never log credentials, model output, selected source text or workspace file contents.
- Do not claim a feature is implemented or a build verified before testing it.

## Development workflow

- Implement changes as **cohesive modules**: tests, types, docs and implementation of one behavior in the same commit.
- Conventional Commit headings, e.g. `feat(host): persist side-session lineage`. Avoid one-file-per-commit.
- TypeScript strict, separate Host/Client runtime boundaries; import cross-runtime types only.
- Preserve domain idempotency, parent isolation, revision checks and storage compatibility.
- Use the existing test runner for domain tests. A change to Host/Client integration also requires a real DSH Web Profile smoke test.
- Keep `package.json`, `dsh.plugin.json` and `cordis.patch.yml` aligned. Run `node scripts/check-manifest.mjs`.
- Dependency install and full build need a pinned DSH development version and a committed `pnpm-lock.yaml` before release.

## Current caveat

Host/Client entry points are **stubs**. No actual side-chat UI, Session Fork, RPC, Agent streaming or read-only enforcement exists yet. File storage is a single-process adapter that has not been wired to Host.
