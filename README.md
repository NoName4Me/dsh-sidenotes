# Side Chat · 旁敲侧击

A context-aware side-conversation plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

> **Developer preview (0.1.0-dev.2)** for **DSH 0.2.2-rc.5**. Installation, Host/Client compilation and the authenticated Host RPC are verified in an actual DSH Web Profile. Manual browser/LLM conversation acceptance is still required before general release.

SideNotes lets you ask anchored questions without derailing the main conversation. Side threads are separate DSH Agent Sessions: the parent context is unchanged unless you explicitly copy an answer back to the main composer.

## Features

- **Ask aside** — Click **侧聊** under a completed assistant response. Select text first to carry a precise quotation into the side thread. Write the question and submit: the child Session is created and the prompt is sent together.
- **Two context modes** — **Light** (default) sends a small, independent contextual quote. **Fork** inherits parent events through the source's completed turn.
- **Right-edge rail** — Switch, collapse and reopen multiple notes without leaving the parent conversation; browse archived/promoted notes in the directory.
- **Resume and manage** — Continue multiround questions, search titles/quotations, jump to rendered source messages, archive, restore or promote a thread into the normal DSH Session list.
- **Bring back deliberately** — Copy an answer, insert a selected response into the parent composer as a quote (never automatically send), or ask the side Agent to summarize the discussion before bringing back its answer.
- **Isolation** — Side Agent tool execution is denied by the Host by default. This is more restrictive than read-only file access and can be relaxed only after an audited permissions policy.

## Install from source (DSH Web / Desktop)

Requires Node.js **24.9+**, pnpm **11.28.5**, and DSH **0.2.2-rc.5**.

```sh
git clone https://github.com/NoName4Me/dsh-sidenotes.git
cd dsh-sidenotes
corepack enable
pnpm install --frozen-lockfile
pnpm build
mkdir -p dist
pnpm pack --pack-destination dist

# In the installed DSH CLI environment:
dsh plugin --profile web add ./dist/dsh-sidenotes-0.1.0-dev.2.tgz
dsh --profile web
```

For **Desktop**, use its own Plugins UI to install or update the tarball, or fully quit Desktop and use the **Desktop-bundled** `dsh` binary (not an npm-installed CLI):

```sh
dsh plugin --profile desktop add /absolute/path/to/dsh-sidenotes-0.1.0-dev.2.tgz
```

Restart Desktop afterward. Desktop and Web have **separate profiles**. Replace the tarball argument with its **absolute path** if you run `dsh plugin` from a different directory. The plugin's activation bundle is included in the package. In the UI, open a conversation and use the **侧聊** action below an assistant response, or select text and click the nearby **侧聊** button.

## Implementation and development

- Product and architecture diagrams: [docs/design.md](docs/design.md)
- Engineering conventions: [docs/development.md](docs/development.md)
- DSH API details: [docs/dsh-integration.md](docs/dsh-integration.md)
- Milestones: [docs/roadmap.md](docs/roadmap.md)
- Coding agent guidance: [AGENTS.md](AGENTS.md)

```sh
pnpm typecheck
pnpm build
pnpm test
```

Main components:

- `src/domain`: anchored note records, lifecycle and durable JSON repository.
- `src/host`: owner-scoped RPC, native DSH Agent lifecycle, history projection, tool-deny policy and promotion.
- `src/client`: message action, side rail, side-thread chat and explicit bring-back.
- `src/shared`: Host/Client protocol identifiers.

## Current limitations

- The panel displays **text** messages and polls the child Session history. It does not yet render the full native Chat tool/image UI.
- The source-jump action requires the source message to be loaded in the current main view.
- The runtime target is fixed to DSH 0.2.2-rc.5, not arbitrary older or newer releases.
- A real user walkthrough with a configured model, hot reload and session promotion across restarts has not yet been confirmed. Do not treat the preview as production-hardened.
- The proposed advanced **main-Agent-side search of other side conversations** is not yet implemented. It remains explicitly opt-in rather than automatically contaminating the parent context.

## License

MIT. See [LICENSE](LICENSE).

## Desktop UI compatibility fix (0.1.0-dev.2)

The first preview incorrectly published `lib/client.js` as an ES module. DSH's Web/Desktop plugin loader requires a classic script factory registered with `window.__ModuleLoader__.load({ id: 'dsh-sidenotes', factory })`. This release emits the required loader wrapper and fails its build check if a bare ESM output reappears. The installed plugin package identity remains `dsh-sidenotes`; the product branding is **Side Chat / 旁敲侧击**.

## Entry placement (Side Chat)

The Side Chat directory and conversation live in an **official DSH right-Sidebar tab**, not a second fixed rail. Click the assistant's **侧聊** action or select text in an assistant message and use the small nearby **侧聊** button; both open the same native tab. The selection button does not suppress DSH's built-in Quote action. The source message must be loaded and its completed assistant action must be present to identify the anchor.

> **Why the button was missing in dev.0:** The first release was built as ESM, which DSH's classic-script loader could not parse. Dev.1 fixed the client loader factory; dev.2 also replaces the extra right-edge rail with the native DSH right Sidebar tab and adds selected-text access. Update/reinstall the new package and restart the Desktop app. A successfully enabled Host plugin alone does not prove its Client factory ran.
