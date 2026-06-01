#!/usr/bin/env bash
set -euo pipefail

# Self-validation loop for the Leo Zed extension.
#
# Only manual prerequisite: install Zed itself (drop Zed.app into /Applications),
# and `npm ci` at the repo root so the shared Node CLIs (leo-lsp-smoke,
# discover-leo-lsp) resolve. Everything else runs unattended.
#
# Passes:
#   0  LSP-wire assertion via the shared leo-lsp-smoke CLI (server is sane)
#   1  configured lsp.leo-lsp.binary.path tier
#   1b Worktree::which / PATH tier (the dominant real-world path)
#   2  leo-lsp absent -> graceful Err, Zed does not crash
#
# NOTE (verify-on-first-run): Zed's headless --foreground stdout format is
# undocumented. The spawn-line greps below were reconciled against a real run;
# if Zed's log format changes on a minor bump, update the grep patterns.

# --- Inputs (overridable for CI) -----------------------------------------
ZED_BIN="${ZED_BIN:-/Applications/Zed.app/Contents/MacOS/cli}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EXT_DIR="$REPO_ROOT/packages/zed"
FIXTURE_DIR="$REPO_ROOT/packages/test-fixtures/samples"
FIXTURE="$FIXTURE_DIR/counter.leo"

DISCOVER="$REPO_ROOT/packages/shared/discovery/discover-leo-lsp/src/index.mjs"
SMOKE="$REPO_ROOT/packages/shared/validation/leo-lsp-smoke/src/index.mjs"

# Resolve leo-lsp via the shared discover CLI (PR 0 §3). Exit 0 + prints an
# absolute path; exit 1 means no candidate exists.
LEO_LSP_BIN="${LEO_LSP_BIN:-$(node "$DISCOVER" || true)}"
if [[ -z "$LEO_LSP_BIN" || ! -x "$LEO_LSP_BIN" ]]; then
  echo "FAIL: leo-lsp not found via shared discover CLI. Install via: cargo install --git https://github.com/ProvableHQ/leo leo-lsp --locked" >&2
  exit 1
fi
if [[ ! -x "$ZED_BIN" ]]; then
  echo "FAIL: Zed CLI not at $ZED_BIN. Install Zed from https://zed.dev/download." >&2
  exit 1
fi

# Track every temp dir so a mid-pass failure (set -e) still cleans up. The
# user's real ~/Library/Application Support/Zed/ is never touched.
TMPDIRS=()
cleanup() { [[ ${#TMPDIRS[@]} -gt 0 ]] && rm -rf "${TMPDIRS[@]}"; }
trap cleanup EXIT

# --- Pass 0: LSP-protocol assertion (delegated to the shared smoke CLI) --
# Coordinate is the `increment` declaration in counter.leo: 1-indexed line 4,
# char 8 (packages/test-fixtures/README.md coordinate table). Invoke by
# absolute node path (NOT npx) since @leo-lsp/smoke is a workspace-private
# package. Bare non-empty Location[] assertion, matching the Cursor/Antigravity
# sibling harnesses.
node "$SMOKE" \
  --server "$LEO_LSP_BIN" \
  --file   "$FIXTURE" \
  --line   4 --char 8
echo "ok: leo-lsp returned a non-empty definition for counter.leo:4:8 (via shared smoke CLI)"

# --- Build the extension's wasm artifact ---------------------------------
( cd "$EXT_DIR" && cargo build --release --target wasm32-wasip2 )
WASM="$EXT_DIR/target/wasm32-wasip2/release/leo_zed_extension.wasm"

# install_ext <user-data-dir>: drop the dev extension into an isolated Zed
# user-data dir. Zed loads dev extensions from <user-data>/extensions/installed/<id>/.
install_ext() {
  local install_dir="$1/extensions/installed/leo"
  mkdir -p "$install_dir"
  rsync -a --delete --exclude target "$EXT_DIR/" "$install_dir/"
  cp "$WASM" "$install_dir/extension.wasm"
}

SPAWN_RE='language.server.*leo-lsp|leo-lsp.*(started|spawn|run)'

# --- Pass 1: configured lsp.leo-lsp.binary.path tier ---------------------
WORK1="$(mktemp -d -t leo-zed-validate1.XXXXXX)"; TMPDIRS+=("$WORK1"); USER1="$WORK1/zed-user-data"; LOG1="$WORK1/logs"
mkdir -p "$USER1/config" "$LOG1"
install_ext "$USER1"
cat >"$USER1/config/settings.json" <<JSON
{
  "lsp": { "leo-lsp": { "binary": { "path": "$LEO_LSP_BIN", "arguments": [] } } },
  "auto_install_extensions": { "leo": true },
  "telemetry": { "diagnostics": false, "metrics": false }
}
JSON
"$ZED_BIN" --foreground --user-data-dir "$USER1" --new "$FIXTURE" >"$LOG1/client.log" 2>&1 &
ZED_PID1=$!; sleep 8; kill -TERM "$ZED_PID1" 2>/dev/null || true; wait "$ZED_PID1" 2>/dev/null || true
if grep -qiE "$SPAWN_RE" "$LOG1/client.log"; then
  echo "ok: Zed spawned leo-lsp via configured binary.path against counter.leo"
else
  echo "FAIL: configured-path branch did not spawn leo-lsp. Log: $LOG1/client.log" >&2
  echo "      (If Zed's headless log format changed, update SPAWN_RE per the verify-on-first-run note.)" >&2
  exit 1
fi
rm -rf "$WORK1"

# --- Pass 1b: no configured path; leo-lsp on PATH -> Worktree::which ------
WORK1B="$(mktemp -d -t leo-zed-validate1b.XXXXXX)"; TMPDIRS+=("$WORK1B"); USER1B="$WORK1B/zed-user-data"; LOG1B="$WORK1B/logs"
mkdir -p "$USER1B/config" "$LOG1B"
install_ext "$USER1B"
cat >"$USER1B/config/settings.json" <<'JSON'
{ "auto_install_extensions": { "leo": true }, "telemetry": { "diagnostics": false, "metrics": false } }
JSON
PATH="$(dirname "$LEO_LSP_BIN"):$PATH" \
  "$ZED_BIN" --foreground --user-data-dir "$USER1B" --new "$FIXTURE" >"$LOG1B/client.log" 2>&1 &
ZED_PID1B=$!; sleep 8; kill -TERM "$ZED_PID1B" 2>/dev/null || true; wait "$ZED_PID1B" 2>/dev/null || true
if grep -qiE "$SPAWN_RE" "$LOG1B/client.log"; then
  echo "ok: leo-lsp resolved via Worktree::which (PATH), not a configured path"
else
  echo "FAIL: Worktree::which branch did not spawn leo-lsp. Log: $LOG1B/client.log" >&2
  exit 1
fi
rm -rf "$WORK1B"

# --- Pass 2: bad configured path -> tier-1 Err, no crash -----------------
WORK2="$(mktemp -d -t leo-zed-validate2.XXXXXX)"; TMPDIRS+=("$WORK2"); USER2="$WORK2/zed-user-data"; LOG2="$WORK2/logs"
mkdir -p "$USER2/config" "$LOG2"
install_ext "$USER2"
cat >"$USER2/config/settings.json" <<'JSON'
{ "lsp": { "leo-lsp": { "binary": { "path": "/definitely/does/not/exist/leo-lsp" } } } }
JSON
"$ZED_BIN" --foreground --user-data-dir "$USER2" --new "$FIXTURE" >"$LOG2/client.log" 2>&1 &
ZED_PID2=$!; sleep 8
# Hard gate: the process is still alive (did not crash).
if ! kill -0 "$ZED_PID2" 2>/dev/null; then
  echo "FAIL: Zed exited/crashed on the bad-config path before teardown. Log: $LOG2/client.log" >&2
  exit 1
fi
kill -TERM "$ZED_PID2" 2>/dev/null || true
wait "$ZED_PID2" 2>/dev/null || true   # SIGTERM teardown is expected; not a failure
echo "ok: Zed survived the bad-configured-path (tier-1 Err) without crashing"
# Best-effort (NOT a gate): surface the tier-1 friendly error if Zed logged it.
if grep -q "did not resolve to an executable" "$LOG2/client.log"; then
  echo "ok: tier-1 friendly error string observed in Zed log"
else
  echo "note: tier-1 friendly-error string not seen in headless log (undocumented surface); not failing on it" >&2
fi
rm -rf "$WORK2"

# --- Pass 2c: no config + leo-lsp absent from PATH -> tier-4 Err, no crash
# Exercises the final "not found on PATH" branch (lib.rs), which the bad-config
# Pass 2 never reaches (a present-but-bad path returns the tier-1 Err first).
WORK2C="$(mktemp -d -t leo-zed-validate2c.XXXXXX)"; TMPDIRS+=("$WORK2C"); USER2C="$WORK2C/zed-user-data"; LOG2C="$WORK2C/logs"
mkdir -p "$USER2C/config" "$LOG2C"
install_ext "$USER2C"
# No binary.path at all -> resolver falls through to Worktree::which, which
# must miss because PATH is scrubbed of any leo-lsp.
cat >"$USER2C/config/settings.json" <<'JSON'
{ "telemetry": { "diagnostics": false, "metrics": false } }
JSON
env -u CARGO_HOME PATH="/usr/bin:/bin" \
  "$ZED_BIN" --foreground --user-data-dir "$USER2C" --new "$FIXTURE" >"$LOG2C/client.log" 2>&1 &
ZED_PID2C=$!; sleep 8
if ! kill -0 "$ZED_PID2C" 2>/dev/null; then
  echo "FAIL: Zed exited/crashed on the no-config/absent-PATH path before teardown. Log: $LOG2C/client.log" >&2
  exit 1
fi
kill -TERM "$ZED_PID2C" 2>/dev/null || true
wait "$ZED_PID2C" 2>/dev/null || true
echo "ok: Zed survived the no-config + absent-PATH (tier-4 Err) without crashing"
# Best-effort (NOT a gate): the tier-4 "not found on PATH" message.
if grep -q "not found on PATH" "$LOG2C/client.log"; then
  echo "ok: tier-4 'not found on PATH' string observed in Zed log"
else
  echo "note: tier-4 not-found string not seen in headless log (undocumented surface); not failing on it" >&2
fi
rm -rf "$WORK2C"

echo "PASS: Zed + leo-lsp end-to-end (smoke CLI + configured-path + Worktree::which + tier-1 Err + tier-4 Err fallback)"
