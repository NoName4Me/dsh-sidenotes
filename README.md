# Side Chat · 旁敲侧击

A context-aware side-conversation plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

> **Developer preview (0.1.0-dev.4)** for **DSH 0.2.2-rc.5**. Installation, Host/Client compilation and the authenticated Host RPC are verified in an actual DSH Web Profile. Manual browser/LLM conversation acceptance is still required before general release.

Side Chat lets you ask anchored questions without derailing the main conversation. Side threads are separate DSH Agent Sessions: the parent context is unchanged unless you explicitly copy an answer back to the main composer.

## Features

- **Ask aside** — Use the native icon action beneath a completed assistant response, or select text and choose **侧聊** beside DSH's existing **引用文本** action within the same capsule. Write the question and submit: the child Session is created and the prompt is sent together.
- **Two context modes** — **Light** (default) sends a small, independent contextual quote. **Fork** inherits parent events through the source's completed turn.
- **Back-to-back navigation** — A quiet search-and-dot rail sits just left of DSH's original Turn Navigator. Hover to expand a searchable card with the original quotation and latest reply.
- **Resume and manage** — Return to any side conversation from its navigation dot or a small marker beside the original message. Jump back to the source and flash only the selected quotation (or the whole source message for a full-message anchor). Archive, restore or promote to a regular DSH Session.
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
dsh plugin --profile web add ./dist/dsh-sidenotes-0.1.0-dev.4.tgz
dsh --profile web
```

For **Desktop**, use its own Plugins UI to install or update the tarball, or fully quit Desktop and use the **Desktop-bundled** `dsh` binary (not an npm-installed CLI):

```sh
dsh plugin --profile desktop add /absolute/path/to/dsh-sidenotes-0.1.0-dev.4.tgz
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

## Desktop UI compatibility fix (0.1.0-dev.4)

The first preview incorrectly published `lib/client.js` as an ES module. DSH's Web/Desktop plugin loader requires a classic script factory registered with `window.__ModuleLoader__.load({ id: 'dsh-sidenotes', factory })`. This release emits the required loader wrapper and fails its build check if a bare ESM output reappears. The installed plugin package identity remains `dsh-sidenotes`; the product branding is **Side Chat / 旁敲侧击**.

## Entry placement (Side Chat)

- **Native right Sidebar:** independent chat history and composer; it shares the Host's tab strip, resizing, and layout.
- **Single directory:** browse and search side conversations in the native right Sidebar's Side Chat home. No extra floating dots or search rail.
- **Message-edge anchor:** a small icon at the right of the original answer's content, aligned to the beginning of the full reply or the selected phrase. Hover shows the quotation and your first question.
- **Selected-text capsule:** DSH's **引用文本** action and **侧聊** share one pill. This integration uses a small portal into the native Quote popup because DSH 0.2.2-rc.5 exposes an exclusive keyed interaction slot; it does not override or disable the built-in action. The menu appears after pointer release / completed keyboard selection, not while dragging.
- **Jump back:** scrolls and flashes the selected text (or the whole message for a full-message side conversation). An exact text match is necessary for phrase-level highlight; if the source content has changed the UI reports the mismatch rather than highlighting unrelated text.

The source message must still be loaded in the current conversation to support exact jumping and message-edge markers.

**Dev.4 UI revision:** removed the redundant companion rail; source highlights the actual reply body, not the footer toolbar; the composer uses a compact dark circular send/stop control; plugin-center metadata and artwork are localized in exported en/zh files. These changes compile and pass Web Host startup checks, but the exact desktop interaction needs a real desktop walkthrough.

> **Why the button was missing in dev.0:** The first release was built as ESM, which DSH's classic-script loader could not parse. Dev.1 fixed the client loader factory; dev.2 also replaces the extra right-edge rail with the native DSH right Sidebar tab and adds selected-text access. Update/reinstall the new package and restart the Desktop app. A successfully enabled Host plugin alone does not prove its Client factory ran.

## Plugin Manager display

The package exports `./icon` (original 36×36 SVG) and `./locale/en.json` / `./locale/zh.json`. DSH resolves the bundle's title and description according to the active UI locale; English is the fallback. The icon file has no enclosing tile so it remains legible in dark and light themes. UI labels keep the **侧边聊** action wording.
