# shared

Substrate consumed by every Leo editor client and tooling integration.

This package is **not published**. It exists so individual client packages
(`packages/vscode`, `packages/zed`, …) and CI workflows can reference one
canonical copy of each cross-cutting artifact instead of duplicating it.

## Contents

| Path | Purpose | Consumers |
|------|---------|-----------|
| `syntaxes/leo.tmLanguage.json` | Canonical TextMate grammar for `.leo`. Regenerated from `ProvableHQ/leo`'s tree-sitter source at sync time. | VS Code, Cursor (via VS Code package), Antigravity (via VS Code package), IntelliJ TextMate fallback, Sublime conversion source. |
| `syntaxes/prism-leo.js` | Prism component for website / docs consumers. Regenerated from `ProvableHQ/leo`'s tree-sitter source at sync time. | leo-docs, Compiler Explorer Monarch derivation. |
| `discovery/discover-leo-lsp/` | Node CLI that resolves an absolute path to `leo-lsp` using the canonical 5-tier algorithm. | Zed, Codex, Sublime, IntelliJ. |
| `validation/leo-lsp-smoke/` | Node CLI that drives one `textDocument/definition` against a `leo-lsp` binary and asserts on the response. | Every client `validate:<client>` script as a precondition check. |
| `config-schema.md` + `config-schema.json` | Canonical definitions of `leo.languageServer.path` and `leo.languageServer.args`. | Every client's settings registration. |
| `identity.md` | Canonical publisher / vendor / language id / scope name / binary name. | Every client manifest. |

## Sync workflow

The tree-sitter source lives upstream in `ProvableHQ/leo/tree-sitter/`; this
package only tracks the *generated* downstream artifacts (TextMate JSON +
Prism JS) so consumers don't have to recompile the grammar. To pick up
upstream Leo grammar changes, with `ProvableHQ/leo` checked out at `../leo`:

    npm run sync:tree-sitter            # regenerate syntaxes/ from upstream
    git diff packages/shared/syntaxes/  # review

Clients that need the raw tree-sitter parser source (Zed, currently) pull it
straight from `ProvableHQ/leo` via their extension manifest's
`repository` + `rev` + `path = "tree-sitter"` pointer — see PR 3 (Zed spec).

## What does *not* belong here

- Client-specific code or build output.
- Anything that depends on a specific editor host's API.
- Third-party-vendor identity (Anysphere, Eclipse, JetBrains, etc.) — those
  live in the per-client manifest.
