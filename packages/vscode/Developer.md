# Leo VS Code Extension

This package contains the Leo 4.0 VS Code extension scaffold for the existing
`aleohq.leo-extension` marketplace entry.

## Current Scope

- Leo language registration for `.leo` files
- Leo 4.0-aware TextMate fallback highlighting
- Optional `leo-lsp` startup when a local server binary is available
- LSP-backed go-to-definition when `leo-lsp` advertises definition support
- Approximate workspace-wide go-to-definition fallback when `leo-lsp` is unavailable
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

## Cursor support

Cursor is a downstream fork of VS Code that uses the same extension manifest,
the same `vscode` extension API, the same VSIX packaging, and the same LSP
plumbing as VS Code. As of June 2025 Cursor pulls extensions from
[Open VSX](https://open-vsx.org/) rather than the Microsoft VS Code Marketplace.

The Leo Cursor integration is the existing `packages/vscode` extension
republished to Open VSX — no separate Cursor package, no Cursor-specific
runtime code.

### Open VSX publish

One-time setup by a maintainer with `ovsx` on PATH (Open VSX requires an
Eclipse account whose GitHub username matches the namespace owner):

```bash
# 1. Register at https://accounts.eclipse.org/user/register (GitHub username
#    must match exactly), then log in to https://open-vsx.org with GitHub and
#    sign the Publisher Agreement.
# 2. Generate a PAT at https://open-vsx.org/user-settings/tokens and export it.
export OVSX_PAT=<token>

# 3. Create the namespace ONCE — must match packages/vscode/package.json:publisher.
npx ovsx create-namespace aleohq -p "$OVSX_PAT"

# 4. Verify the token works.
npx ovsx verify-pat aleohq
```

Add `OPEN_VSX_TOKEN` as a GitHub Actions repository or org secret.

Once configured, maintainers can publish from the Actions tab with
`.github/workflows/publish-openvsx-extension.yml`. The workflow:

- checks out the default branch
- requires an exact version input such as `0.49.1`
- verifies the input matches `packages/vscode/package.json` (no mutation)
- builds the extension and uploads `dist/leo-extension.vsix`
- publishes `aleohq.leo-extension` to https://open-vsx.org via
  `HaaLeo/publish-vscode-extension@v2`

For manual publishes, after running `npm run package:vscode`:

```bash
npm run publish:openvsx
# equivalent to: ovsx publish dist/leo-extension.vsix --pat $OVSX_PAT
```

Open VSX rejects duplicate versions; use `ovsx publish --skip-duplicate` if
retrying.

### Cursor smoke test

`npm run validate:cursor` builds the extension, packages a VSIX, compiles the
test harness, and drives a real Cursor binary headless against the
`packages/test-fixtures/samples/counter.leo` fixture.

Prerequisites (local-only — Cursor is not redistributable, so CI does not run
this leg unless a runner has Cursor installed):

- Install Cursor from https://cursor.com/ (macOS default install path is
  `/Applications/Cursor.app`). Alternatively export `CURSOR_CLI` to the
  absolute path of the `cursor` shell command.
- The default macOS CLI path the harness resolves is
  `/Applications/Cursor.app/Contents/Resources/app/bin/cursor`. Install it via
  the Cursor command palette → "Shell Command: Install 'cursor' command in
  PATH" if it is missing.

Run the full loop from the monorepo root:

```bash
npm run validate:cursor:teardown   # remove any prior $TMPDIR/leo-cursor-it state
npm run validate:cursor            # build → package → compile harness → drive Cursor → assert
```

Output:

- `PASS: Leo extension drove a real LSP request in Cursor (logs in /tmp/leo-cursor-it/logs)`
- `FAIL: <reason>; see /tmp/leo-cursor-it/logs/...`

The harness uses `--user-data-dir` and `--extensions-dir` pointed at
`$TMPDIR/leo-cursor-it/`, so your real Cursor installation, extensions, and
settings are untouched.

#### Exercising the real LSP path

By default the harness runs the no-LSP fallback path: open `.leo` files, no
`leo-lsp` started. To exercise the full LSP handshake set `LEO_REQUIRE_LSP=1`
and make sure a `leo-lsp` binary is discoverable on PATH (the discovery order
documented in `packages/vscode/src/languageServer.ts` applies):

```bash
# Build leo-lsp from the sibling Leo checkout:
cargo build --release --manifest-path ../leo/Cargo.toml --bin leo-lsp
PATH="$(pwd)/../leo/target/release:$PATH" LEO_REQUIRE_LSP=1 npm run validate:cursor

# Or install it from git:
cargo install --git https://github.com/ProvableHQ/leo leo-lsp --root /tmp/leo-cli
PATH="/tmp/leo-cli/bin:$PATH" LEO_REQUIRE_LSP=1 npm run validate:cursor
```

`LEO_REQUIRE_LSP=1` makes the harness fail if it does not observe a
`"Starting leo-lsp from"` line in the captured Leo Language Server output
channel log.

For an LSP-protocol-level precondition independent of Cursor, the shared
smoke CLI at `packages/shared/validation/leo-lsp-smoke/` drives `leo-lsp`
directly over stdio:

```bash
npx leo-lsp-smoke \
  --server "$(which leo-lsp)" \
  --file   "$(pwd)/packages/test-fixtures/samples/counter.leo" \
  --line   4 --char 8
```
