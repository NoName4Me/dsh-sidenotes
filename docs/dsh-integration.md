# DSH 0.2.2 Host integration notes

**Target**: DSH 0.2.2-rc.5. Host and Client types/build are checked in CI; installation in a running Web Profile is not yet verified.

| SideNotes need | Official DSH public seam |
|---|---|
| Load parent and child events, including cold sessions | `ctx.sessionQuery.observeSession(SessionId(id))` |
| Replayable parent prefix | `buildForkSeed(events, SessionSeq(boundary))` |
| Create persistent agent and Session | `ctx.agents.create({sessionId, seed, inheritedEventCount, parentSource, meta, setup})` |
| Restore after restart | `ctx.agents.resume({resumeSessionId, setup})` |
| Followup / cancellation | `agent.followup(createUserMessage(...))`, `agent.cancel({kind:'user'})` |
| Hide while idle | `ctx.workspaceRegistry.archiveSession(id)` |
| Make visible for work / promotion | `ctx.workspaceRegistry.unarchiveSession(id)` |
| Fail-closed tools | `agentCtx.tools.guard()` within Agent `setup` |

## Critical distinctions

- `ctx.sessions.fork()` produces a live in-memory Session, *not* the full
  persisted Agent lifecycle, so SideNotes does not use it for child creation.
- The actual Host bridge has a **deny-all tool guard**, including nested PTC
  subcalls. Permitting read-only tools is a separate audited change.
- Fork uses the **first finished turn containing or following the anchor**, not
  the latest entire parent history. The parent's later messages do not leak in.
- The child Session's ID derives from the persisted SideNote ID:
  `session-sidenotes-${note.id}`. Retry therefore finds the existing Session
  before any new creation and never silently duplicates its identity.
- Default mode is `light`. It seeds no inherited events but records a
  bounded note context using Agent injection. `fork` uses original event IDs.
- A side Session is hidden via workspace archival when idle; before followup
  it is temporarily unarchived and rearchived when idle. Promotion unarchives
  the exact same Session. This is separate from the SideNote metadata state.
- The plugin must own AgentHandle disposers and release them on plugin unload.
  `ctx.agents.get()` alone does not confer ownership.
- The Host Coordinator authorization and anchor checks are a separate
  capability that must be wired into authenticated Remote calls before
  enabling the browser. No public HTTP routes are created.

## Remaining verified-runtime gates

1. DSH 0.2.2-rc.5 TypeScript/build checks and frozen lockfile installation pass CI; **real plugin installation and Remote mount** remain outstanding.
2. The Host entry must mount an authenticated Remote with per-call access
   checks; until then the bridge is available only to a composition test.
3. Archiving on startup and rearchiving around every completed turn must be
   exercised in an actual DSH Web Profile.
4. The Client UI and streaming event subscriptions still need to be built.
5. Even after installation, write-tool denial must be tested under both native
   and PTC tool execution modes.

Source contracts:
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/core.md
- https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/api/session-controller/src/commands.ts
- https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/workspace/workspace/src/index.ts
- https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/tools/src/index.ts

## Fork transcript projection

A fork keeps the parent event prefix for model context. The SideNotes panel filters events where `seq < inheritedEventCount` so inherited messages do not reappear as if they were side-thread messages. The source prefix remains in the underlying Session event log.

## Startup smoke: injection requirements

The first packaged Web Profile startup succeeded as a Web application but reported that SideNotes failed to activate. The error was `cannot get property \"webServer\" without inject` while mounting the Connection RPC handler. The Host now declares the `webServer` injection explicitly, and the smoke workflow treats all `entry did not activate` warnings as failures. A Web URL by itself is **not** proof of plugin activation.

## Working RPC transport

SideNotes now registers a DSH WebServer `prefix` route with `auth: required` rather than calling the Connection RPC registry from a separate Cordis service Context. The route accepts the same Connection `client-request` / `server-response` JSON envelope and checks payload size, method, registered owner Peer and Session ownership. DSH WebServer/Connection retain authoritative Host and Origin admission. The existing Client `connection.rpc.call('/sidenotes', ...)` contract is unchanged. This is an authenticated Host route, not an anonymous HTTP endpoint.

## Live Web smoke result (2026-11-20)

The packaged SideNotes plugin has been installed into a clean DSH 0.2.2-rc.5 Web Profile by the official CLI. The Web process starts without plugin activation warnings. A login-token exchange grants a browser Cookie, and an authenticated POST to `/sidenotes/list` returns the SideNotes application's own JSON envelope. This confirms package installation, Host activation, WebServer mounting, DSH cookie admission and Host RPC reachability. It does **not** establish that a configured LLM has completed a side-thread response in a real browser.
