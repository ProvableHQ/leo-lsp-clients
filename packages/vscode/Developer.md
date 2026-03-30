# Leo VS Code Extension

This package contains the Leo 4.0 VS Code extension scaffold for the existing
`aleohq.leo-extension` marketplace entry.

## Current Scope

- Leo language registration for `.leo` files
- Leo 4.0-aware TextMate fallback highlighting
- Approximate workspace-wide go-to-definition for top-level symbols
- TextMate and Prism syntax artifacts generated directly from the Leo monorepo
  tree-sitter source
- No vendored tree-sitter snapshot checked into this repo

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

If GitHub Actions needs explicit access to the Leo repo, set
`LEO_REPO_READ_TOKEN` in this repository's secrets.

## Packaging

Build the extension:

```bash
npm run build --workspace leo-extension
```

Create a `.vsix`:

```bash
npm run package:vscode
```
