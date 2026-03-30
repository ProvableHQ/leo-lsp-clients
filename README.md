# leo-lsp-clients

IDE integrations and language server clients for the Leo programming language.

This workspace is intended to be the long-term home for Leo editor clients and
adjacent tooling: VS Code today, and eventually other integrations such as Zed,
Vim, Cursor, Sublime Text, MCP-facing tooling, and shared client infrastructure.

## Workspace Layout

- `packages/vscode`: The Leo VS Code extension that will continue publishing to
  the existing `aleohq.leo-extension` marketplace listing.
- `packages/shared`: Shared code and assets for future Leo client packages.
- `packages/test-fixtures`: Small Leo programs for integration testing and
  smoke tests.

## Current Focus

The current implementation work is centered on the VS Code extension:

- syntax artifacts generated from Leo's tree-sitter source in the main
  `ProvableHQ/leo` repo for both VS Code and Prism-based website consumers
- a lean client-side extension scaffold
- a clean migration path toward future Rust-based language tooling

## Where To Look

- VS Code user-facing extension README:
  `packages/vscode/README.md`
- VS Code developer and release workflow notes:
  `packages/vscode/Developer.md`
- Shared generated website syntax assets:
  `packages/shared/README.md`
- VS Code tag-watching sync automation:
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
npm run build
npm run package:vscode
```

The root workspace README intentionally stays lightweight. Package-specific
details, sync behavior, and release flow documentation should live with the
package they belong to.
