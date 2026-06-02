# Leo Zed extension — developer notes

Implementation reference: `5. PR 3 Spec - Zed client.md` in the Q2 Client
Integration spec set. Identity strings: [`packages/shared/identity.md`](../shared/identity.md).
Config schema: [`packages/shared/config-schema.md`](../shared/config-schema.md).

## Layout

```
packages/zed/
  extension.toml            # Zed manifest: grammar pin + language-server decl
  Cargo.toml                # leo-zed-extension (cdylib -> wasm32-wasip2)
  Cargo.lock                # committed; required by zed dev-extension builds
  rust-toolchain.toml       # pins 1.85.0 + wasm32-wasip2 target (Zed's target)
  src/lib.rs                # the whole extension (~110 lines)
  languages/leo/
    config.toml             # language registration
    highlights.scm          # regenerated from ProvableHQ/leo/tree-sitter/queries
    indents.scm             # regenerated from upstream
    brackets.scm            # regenerated from upstream (see "Transitional state")
    outline.scm             # regenerated from upstream (see "Transitional state")
  scripts/validate.sh       # builds the wasm + leo-lsp-smoke LSP-wire assertion
```

## Build & validate

```bash
npm run build:zed       # cargo build --release --target wasm32-wasip2
npm run validate:zed    # build wasm + leo-lsp-smoke definition assertion
```

`validate:zed` requires only `npm ci` at the repo root (it shells the
workspace-private `leo-lsp-smoke` / `discover-leo-lsp` CLIs) and a `leo-lsp` on
`PATH`/`$CARGO_HOME`. It (1) builds the extension for `wasm32-wasip2` and (2)
drives a real `textDocument/definition` against `leo-lsp` via the shared smoke
CLI. It does **not** install or launch Zed — see "Why validation doesn't drive a
headless Zed" below.

## Local dev install (the real extension-load verification)

Command palette → **zed: install dev extension** → pick `packages/zed/`. Zed
compiles the wasm via your rustup toolchain, **component-encodes** it, fetches +
builds the grammar from `ProvableHQ/leo`, and loads it; edits trigger a rebuild.
(Rust must be installed via rustup, not Homebrew, or dev-extension installs
fail.) This is the authoritative end-to-end check — confirmed on Zed 1.4.4:
extension + grammar compile to wasm and `leo-lsp` spawns over stdio on a `.leo`
file. Watch `~/Library/Logs/Zed/Zed.log` for `compiled grammar leo` and
`starting language server process … leo-lsp`.

### Why validation doesn't drive a headless Zed

Zed installs a dev extension by compiling **and component-encoding** the wasm
itself (the `install dev extension` command runs `wit-component` to turn the core
module into a wasm *component*; the raw `cargo build` output is ~325 KB, the
loaded component is ~1.1 MB). There is no headless/CLI equivalent of that
encode+install step, and Zed's `--foreground` stdout does not surface extension
load/LSP-spawn lines, so a scripted "open a file in headless Zed and grep the
log" check can neither load the extension nor observe it. `validate.sh`
therefore verifies the two things it *can* prove deterministically (the wasm
builds for Zed's target; `leo-lsp` answers the wire), and extension load is
verified by the manual dev-install above.

## Grammar pin & the regenerated query files

The tree-sitter parser is **not** vendored. `extension.toml`'s `[grammars.leo]`
points Zed at `ProvableHQ/leo` and pins `rev` to the resolved **commit** of a
Leo release tag (dereference annotated tags with `git rev-parse '<tag>^{commit}'`
— `rev-parse <tag>` alone yields the tag-object sha, which is wrong). Zed clones
that repo at `rev` and compiles `tree-sitter/` into the parser.

The four `.scm` query files are extension-owned (Zed loads queries from the
extension, not the grammar clone), tracked as **regenerated artifacts — never
hand-edited**. They are synced by `scripts/sync-grammar-artifacts.sh`, which also
rewrites `extension.toml`'s `rev`. `.github/workflows/watch-leo-tags.yml` commits
all of it — the `rev`, the four queries, the VS Code TextMate JSON, and the Prism
JS — in one PR so every artifact stays pinned to the same upstream commit.

To regenerate from a specific release tag (not `HEAD`):

```bash
./scripts/sync-grammar-artifacts.sh ../leo <leo-release-tag>
```

## Transitional state (remove once ProvableHQ/leo#29469 is tagged)

`brackets.scm` and `outline.scm` did not exist upstream when this extension
landed. They were authored in [ProvableHQ/leo#29469](https://github.com/ProvableHQ/leo/pull/29469)
and pre-seeded here from that PR's content, validated against the pinned
grammar with `tree-sitter query`.

Until #29469 is merged **and included in a Leo release tag**:

- The current pin is `leo-lang-v4.1.0` (commit `9056dc2d…`), which is **newer**
  than the `v4.0.2` the VS Code TextMate/Prism artifacts currently track
  (`packages/vscode/generated-from-leo.json`). This skew is transient: the next
  `watch-leo-tags` sync bumps every artifact to the same tag.
- `sync-grammar-artifacts.sh` copies `highlights.scm`/`indents.scm` from the
  pinned tag but only **warns** (keeps the committed seed) for the not-yet-tagged
  `brackets.scm`/`outline.scm`.

Once #29469 ships in a tag: bump the pin to that tag, run the sync (all four
files now copy from upstream), and tighten the sync script's missing-file
warning to a hard error.

## Release / marketplace

1. Bump `version` in `extension.toml` and `Cargo.toml`. Cadence: one tag per Leo
   minor release, matching `packages/vscode`.
2. Tag the monorepo `zed-vX.Y.Z`.
3. In a fork of `zed-industries/extensions`, add this repo as a submodule and an
   `extensions.toml` entry with `path = "packages/zed"` (required — the extension
   is not at the repo root), run `pnpm sort-extensions`, and open a PR. On merge,
   Zed Industries builds and ships the wasm.

No signing/notarization — Zed extensions are sandboxed wasm; the registry PR is
the trust gate.

License: **GPL-3.0-only**, matching the bundled `LICENSE.txt`, the repo root
`LICENSE`, and upstream Leo (`tree-sitter-leo` is `GPL-3.0-only`). The spec
§3.2's `Apache-2.0 OR MIT` was a mis-copy from the Sway/Fuel reference extension
and was corrected to GPL-3.0 so the declared license matches the shipped text.

## Known risks (verify on Zed minor bumps)

- **Wasm target tracks Zed's builder, not us.** Zed compiles extensions for
  `wasm32-wasip2` (verified on Zed 1.4.4); older Zed used `wasm32-wasip1`. If a
  dev-extension install fails with `error[E0463]: can't find crate for 'core' …
  the 'wasm32-wasipN' target may not be installed`, Zed changed its target —
  update `rust-toolchain.toml` `targets`, `package.json` `build:zed`,
  `validate.sh`, and `build-zed-extension.yml` to match, and `rustup target add`
  it. The spec's original `wasm32-wasip1` was stale for current Zed.
- **No automated extension-load test.** Extension load + grammar build are only
  exercised by the manual `zed: install dev extension` (see above), because Zed
  has no headless encode+install path. When changing `src/lib.rs`, the manifest,
  or the query files, re-run that manual install and confirm highlighting +
  `leo-lsp` spawn before merging.
