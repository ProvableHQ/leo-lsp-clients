# Leo VS Code Extension

This package contains the Leo 4.0 VS Code extension scaffold for the existing
`aleohq.leo-extension` marketplace entry.

## Current Scope

- Leo language registration for `.leo` files
- Leo 4.0-aware TextMate fallback highlighting
- Approximate workspace-wide go-to-definition for top-level symbols
- Optional `leo-lsp` startup when a local server binary is available
- TextMate and Prism syntax artifacts generated directly from the Leo monorepo
  tree-sitter source
- No vendored tree-sitter snapshot checked into this repo

## Contributing

See the repository-level `CONTRIBUTING.md` for local extension and Leo LSP
validation notes.

## Syncing Tree-Sitter Source

For current testing before a Leo 4.0 release tag exists, fetch the latest Leo
`master` in the sibling checkout and then run:

```bash
git -C ../leo fetch origin master
npm run sync:tree-sitter
```

For the actual Leo 4.0 release process, sync from the Leo 4.0 release tag
instead of from `master` so the extension ships against the released language
syntax:

```bash
./scripts/sync-tree-sitter-from-leo.sh ../leo <leo-4.0-tag>
```

The plan is to test from `master` for now, then publish the updated
`aleohq.leo-extension` marketplace package after Leo mainnet ships. Because the
extension identity stays the same, existing VS Code users should receive the
update automatically.

## Generated Syntax Artifacts

The shipped syntax artifacts are generated from the Leo monorepo tree-sitter
source and are not maintained by hand:

- `packages/vscode/syntaxes/leo.tmLanguage.json`
- `packages/shared/syntaxes/prism-leo.js`

The generation flow reads:

- `../leo` at a chosen git ref
- `tree-sitter/src/grammar.json`
- `tree-sitter/queries/highlights.scm`

and rebuilds the generated artifacts via:

```bash
npm run generate:syntaxes
```

The sync script runs that generator automatically and also refreshes
`packages/vscode/generated-from-leo.json`, so the shipped artifacts stay aligned
with Leo while still recording which Leo ref produced them.

## Automated Tag Watching

The repo-level workflow `.github/workflows/watch-leo-tags.yml` watches the Leo
repo for new stable release tags on an hourly schedule and can also be run
manually.

Its behavior is driven by `.github/leo-tag-sync.json`:

- `sourceRepo`: which Leo repo to watch
- `stableTagPattern`: which tags count as stable releases
- `syncBranch`: the fixed automation branch used for the sync PR
- `pullRequestTitlePrefix`: the PR title prefix for generated sync PRs

When a newer stable Leo tag appears, the workflow regenerates the TextMate and
Prism syntax artifacts from that tag, updates `generated-from-leo.json`, and
opens or updates a reviewable PR. It does not publish the extension
automatically, so release and Marketplace publish remain manual steps after
review.

A companion workflow, `.github/workflows/sync-prism-to-leo-docs.yml`, syncs the
generated Prism component into `leo-docs` after the shared artifact changes on
this repository's default branch.

These automations expect the following repository or org-level secrets:

- `LEO_REPO_READ_TOKEN`: `contents: read` on `ProvableHQ/leo` for
  `.github/workflows/watch-leo-tags.yml`
- `LEO_DOCS_WRITE_TOKEN`: `contents: write` and `pull-requests: write` on
  `ProvableHQ/leo-docs` for `.github/workflows/sync-prism-to-leo-docs.yml`

## Packaging

Build the extension:

```bash
npm run build --workspace leo-extension
```

Create a `.vsix`:

```bash
npm run package:vscode
```

## Manual Marketplace Publish

Once `VSCODE_PUBLISHER_TOKEN` is configured for this repository, maintainers can
publish from the Actions tab with `.github/workflows/publish-vscode-extension.yml`.

The manual workflow:

- checks out the default branch
- requires an exact version input such as `0.49.1`
- builds the extension and uploads `dist/leo-extension.vsix`
- publishes `aleohq.leo-extension` to the VS Code Marketplace
- leaves the repository version untouched, so a follow-up commit can sync repo
  metadata with the published version when needed
