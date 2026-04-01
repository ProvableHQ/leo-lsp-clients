#!/usr/bin/env bash

# Regenerates the Leo syntax artifacts from a specific Leo git ref.
# - Verifies the chosen ref exists in the Leo repo and contains tree-sitter data.
# - Runs `scripts/generate-syntax-artifacts.mjs` against that ref.
# - Updates the generated TextMate grammar, Prism component, and source metadata file.

set -euo pipefail

LEO_REPO="${1:-../leo}"
LEO_REF="${2:-FETCH_HEAD}"

if ! git -C "$LEO_REPO" rev-parse --verify "${LEO_REF}^{commit}" >/dev/null 2>&1; then
  echo "Unable to resolve ref '$LEO_REF' in $LEO_REPO" >&2
  exit 1
fi

if ! git -C "$LEO_REPO" cat-file -e "${LEO_REF}:tree-sitter/src/grammar.json" >/dev/null 2>&1; then
  echo "Ref '$LEO_REF' in $LEO_REPO does not contain tree-sitter assets." >&2
  exit 1
fi

node ./scripts/generate-syntax-artifacts.mjs \
  --leo-repo "$LEO_REPO" \
  --leo-ref "$LEO_REF" \
  --textmate-output "packages/vscode/syntaxes/leo.tmLanguage.json" \
  --prism-output "packages/shared/syntaxes/prism-leo.js" \
  --metadata "packages/vscode/generated-from-leo.json"

echo "Generated Leo syntax artifacts from $LEO_REPO at $LEO_REF"
