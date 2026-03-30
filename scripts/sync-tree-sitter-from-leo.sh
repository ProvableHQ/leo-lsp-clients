#!/usr/bin/env bash

# Regenerates the VS Code grammar from a specific Leo git ref.
# - Verifies the chosen ref exists in the Leo repo and contains tree-sitter data.
# - Runs `scripts/generate-textmate-grammar.mjs` against that ref.
# - Updates the generated TextMate grammar and the source metadata file.

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

node ./scripts/generate-textmate-grammar.mjs \
  --leo-repo "$LEO_REPO" \
  --leo-ref "$LEO_REF" \
  --output "packages/vscode/syntaxes/leo.tmLanguage.json" \
  --metadata "packages/vscode/generated-from-leo.json"

echo "Generated TextMate grammar from $LEO_REPO at $LEO_REF"
