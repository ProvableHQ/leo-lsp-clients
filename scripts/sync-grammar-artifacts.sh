#!/usr/bin/env bash

# Regenerates the downstream Leo grammar artifacts (TextMate JSON, Prism
# component, provenance metadata) from a specific Leo git ref.
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

ZED_QUERY_DIR="packages/zed/languages/leo"
ZED_MANIFEST="packages/zed/extension.toml"

if [ -d "$ZED_QUERY_DIR" ]; then
  for q in highlights indents brackets outline; do
    src="tree-sitter/queries/$q.scm"
    if ! git -C "$LEO_REPO" cat-file -e "${LEO_REF}:${src}" 2>/dev/null; then
      echo "Ref '$LEO_REF' in $LEO_REPO does not contain ${src}." >&2
      exit 1
    fi
  done
fi

node ./scripts/generate-syntax-artifacts.mjs \
  --leo-repo "$LEO_REPO" \
  --leo-ref "$LEO_REF" \
  --textmate-output "packages/shared/syntaxes/leo.tmLanguage.json" \
  --prism-output "packages/shared/syntaxes/prism-leo.js" \
  --metadata "packages/vscode/generated-from-leo.json"

echo "Generated Leo grammar artifacts from $LEO_REPO at $LEO_REF"

# --- Zed extension: sync tree-sitter query files + pin the grammar rev ----
# Zed loads .scm queries from the extension package (not the cloned grammar),
# so they are tracked here as regenerated artifacts. The grammar itself is
# fetched by Zed from ProvableHQ/leo at the rev pinned in extension.toml, which
# we rewrite to the same resolved commit the rest of the artifacts came from.
if [ -d "$ZED_QUERY_DIR" ]; then
  RESOLVED_COMMIT="$(git -C "$LEO_REPO" rev-parse "${LEO_REF}^{commit}")"

  # Copy every query file that Zed consumes from the selected release.
  for q in highlights indents brackets outline; do
    src="tree-sitter/queries/$q.scm"
    git -C "$LEO_REPO" show "${LEO_REF}:${src}" >"$ZED_QUERY_DIR/$q.scm"
    echo "  synced $ZED_QUERY_DIR/$q.scm from $LEO_REF"
  done

  # Rewrite the single `rev = "..."` line in extension.toml to the resolved commit.
  if [ -f "$ZED_MANIFEST" ]; then
    perl -i -pe "s/^(\s*rev\s*=\s*\")[0-9a-f]+(\".*)$/\${1}${RESOLVED_COMMIT}\${2}/" "$ZED_MANIFEST"
    echo "  pinned $ZED_MANIFEST grammars.leo.rev = $RESOLVED_COMMIT"
  fi
fi
