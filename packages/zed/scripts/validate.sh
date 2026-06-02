#!/usr/bin/env bash
set -euo pipefail

# Validation for the Leo Zed extension.
#
# Checks (both CI-able and meaningful):
#   1. The extension compiles to Zed's wasm target (wasm32-wasip2).
#   2. leo-lsp itself answers a real LSP textDocument/definition request,
#      via the shared leo-lsp-smoke CLI (PR 0 §3).
#
# What this deliberately does NOT do: drive a headless Zed to load the
# extension. Zed installs a dev extension by COMPILING and COMPONENT-ENCODING
# it itself (the `zed: install dev extension` command) — the raw `cargo build`
# module is a core module, not the wasm *component* Zed loads, and there is no
# headless/CLI equivalent of that encode+install step. Extension load, grammar
# build, and LSP spawn-in-editor are therefore verified by the manual dev-install
# flow (README / Developer.md), confirmed working on Zed 1.4.4.
#
# Prerequisite: `npm ci` at the repo root so the shared Node CLIs resolve.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EXT_DIR="$REPO_ROOT/packages/zed"
FIXTURE="$REPO_ROOT/packages/test-fixtures/samples/counter.leo"
DISCOVER="$REPO_ROOT/packages/shared/discovery/discover-leo-lsp/src/index.mjs"
SMOKE="$REPO_ROOT/packages/shared/validation/leo-lsp-smoke/src/index.mjs"

# --- 1. Build the extension wasm for Zed's target ------------------------
( cd "$EXT_DIR" && cargo build --release --target wasm32-wasip2 )
echo "ok: extension compiles to wasm32-wasip2"

# --- 2. LSP-wire assertion against a real leo-lsp ------------------------
# discover CLI exits 0 + prints an absolute path; exit 1 means none found.
LEO_LSP_BIN="${LEO_LSP_BIN:-$(node "$DISCOVER" || true)}"
if [[ -z "$LEO_LSP_BIN" || ! -x "$LEO_LSP_BIN" ]]; then
  echo "FAIL: leo-lsp not found via shared discover CLI. Install via: cargo install --git https://github.com/ProvableHQ/leo leo-lsp --locked" >&2
  exit 1
fi

# Coordinate: the `increment` declaration in counter.leo, 1-indexed line 4
# char 8 (packages/test-fixtures/README.md). Invoke by absolute node path (not
# npx) since @leo-lsp/smoke is a workspace-private package. Bare non-empty
# Location[] assertion, matching the Cursor/Antigravity sibling harnesses.
node "$SMOKE" \
  --server "$LEO_LSP_BIN" \
  --file   "$FIXTURE" \
  --line   4 --char 8
echo "ok: leo-lsp resolved a definition for counter.leo:4:8 (shared smoke CLI)"

echo "PASS: leo-zed builds (wasm32-wasip2) and leo-lsp answers definitions."
echo "Note: extension load + grammar build are verified via 'zed: install dev extension' (manual; see packages/zed/Developer.md)."
