# SideNotes · 旁注对话

A context-aware side-conversation plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

> **Status: early development.** The plugin is not yet ready for daily use. Do not install it as a production extension.

SideNotes keeps your main conversation focused while letting you ask questions in independent, anchored side threads. Threads are intended to be collapsible, searchable, optionally promoted into full sessions, and selectively referenced in the main conversation.

## Project status

- Product and architecture design: [docs/design.md](docs/design.md)
- Engineering conventions: [docs/development.md](docs/development.md)
- Implementation milestones: [docs/roadmap.md](docs/roadmap.md)

## Principles

1. Main-thread context is not changed by side-thread activity.
2. Side threads are anchored to a specific message or selection.
3. Promotion to a visible session and returning a conclusion to the parent are separate actions.
4. Prefer public Harness extension points over modifying the Harness source.
5. Default to read-only side threads; do not silently grant workspace write access.

## Development

This repository uses TypeScript, with separate Host and Client entry points. The manifest, build and integration checks will be added incrementally. Refer to the [development guide](docs/development.md) before contributing.

## License

MIT. See [LICENSE](LICENSE).
