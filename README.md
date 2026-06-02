# leo-lsp-clients

IDE integrations and language server clients for the Leo programming language.

This workspace is the long-term home for Leo editor clients and adjacent
tooling. All clients share `leo-lsp` (the Leo language server) and the
tree-sitter grammar + queries regenerated from upstream `ProvableHQ/leo`.

## Supported clients

| Client | Integration | Package / distribution |
|--------|-------------|------------------------|
| **VS Code** | Native extension | `packages/vscode` → VS Code Marketplace (`aleohq.leo-extension`) |
| **Cursor** | Runs the VS Code extension | `packages/vscode` → Open VSX |
| **Antigravity** | Runs the VS Code extension | `packages/vscode` → Open VSX |
| **Zed** | Native extension | `packages/zed` → Zed extensions registry |

Cursor and Antigravity are VS Code–compatible editors: they install the same
extension from `packages/vscode` (via Open VSX) and each has its own validation
harness. Zed is a separate, native Rust extension. Further integrations (Sublime
Text, JetBrains, MCP-facing tooling) are planned.

## Workspace Layout

- `packages/vscode`: The Leo VS Code extension that will continue publishing to
  the existing `aleohq.leo-extension` marketplace listing. Also the extension
  installed by Cursor and Antigravity (via Open VSX).
- `packages/zed`: The native Leo extension for the Zed editor (Rust →
  `wasm32-wasip2`). Registers the `leo` language, pins the tree-sitter grammar
  to a `ProvableHQ/leo` release commit, and launches `leo-lsp` over stdio. See
  `packages/zed/README.md` (install/usage) and `packages/zed/Developer.md`
  (build, validation, release).
- `packages/shared`: Shared substrate consumed by every Leo editor client and
  by CI workflows. See `packages/shared/README.md` for the per-subdirectory
  index. Contains the canonical TextMate grammar (regenerated from
  upstream `ProvableHQ/leo`'s tree-sitter source), the `@leo-lsp/discover`
  and `@leo-lsp/smoke` Node CLIs, the canonical configuration schema, and
  the identity canon.
- `packages/test-fixtures`: Small Leo programs for integration testing and
  smoke tests. The `README.md` in this package is the **normative coordinate
  table** for every assertion any client makes against a Leo fixture.
- `.github/actions/build-leo-lsp`, `.github/actions/build-leo`: Composite
  actions that check out `ProvableHQ/leo` at a chosen ref, build the
  respective binary, and add it to `$GITHUB_PATH`. Used by every client
  validation workflow.

## Current Focus

The VS Code extension (also serving Cursor and Antigravity) and the Zed
extension are the shipping clients. Cross-cutting work:

- syntax artifacts generated from Leo's tree-sitter source in the main
  `ProvableHQ/leo` repo, kept in lockstep across consumers (VS Code TextMate,
  Prism for the website, and the Zed tree-sitter queries) by one sync workflow
- lean client-side extension scaffolds that defer real language features to
  `leo-lsp`
- a clean migration path toward future Rust-based language tooling

## Where To Look

- VS Code user-facing extension README:
  `packages/vscode/README.md`
- VS Code developer and release workflow notes:
  `packages/vscode/Developer.md`
- Zed user-facing extension README:
  `packages/zed/README.md`
- Zed developer, build, and release notes:
  `packages/zed/Developer.md`
- Repository contribution notes:
  `CONTRIBUTING.md`
- Shared generated website syntax assets:
  `packages/shared/README.md`
- Leo tag-watching sync automation (TextMate, Prism, and Zed grammar/queries):
  `.github/workflows/watch-leo-tags.yml`
- Downstream docs Prism sync automation:
  `.github/workflows/sync-prism-to-leo-docs.yml`
- Sync automation configuration:
  `.github/leo-tag-sync.json`

## Quick Start

For local VS Code extension development:

```bash
npm install
git -C ../leo fetch origin master
npm run sync:tree-sitter
npm run build:vscode
npm run package:vscode
```

For the Zed extension:

```bash
npm install               # for the shared leo-lsp-smoke / discover CLIs
npm run build:zed         # cargo build --release --target wasm32-wasip2
npm run validate:zed      # builds the wasm + leo-lsp-smoke definition assertion
```

To run it in Zed, use the command palette → **zed: install dev extension** →
select `packages/zed` (Zed compiles + loads it). See `packages/zed/Developer.md`.

The root workspace README intentionally stays lightweight. Package-specific
details, sync behavior, and release flow documentation should live with the
package they belong to.
