# Canonical Leo client configuration schema

Every Leo editor client exposes the same two settings. The names below are
normative; do not invent client-specific names like `leoLsp.path` or
`leoLanguageServer.serverPath`. Field semantics match the VS Code reference
client (`packages/vscode/src/languageServer.ts:72-140`) byte-for-byte.

## Fields

### `leo.languageServer.path`

- Type: `string`.
- Default: `""` (empty string).
- Description: Absolute or workspace-relative path to the `leo-lsp`
  executable. A leading `~/` is expanded to the user's home directory.
  When unset (empty string), the client falls back to the 5-tier
  discovery order in `packages/shared/discovery/discover-leo-lsp/`.
- Validation: a non-empty value that does not resolve to an executable
  file emits a one-line warning to the client's Leo Language Server output
  channel and then falls through to discovery; the client never errors out
  on a bad value.

### `leo.languageServer.args`

- Type: `string[]`.
- Default: `[]`.
- Description: Additional arguments appended to the `leo-lsp` command
  line. Passed through verbatim. No shell expansion.

## Per-client mapping

Each client expresses these in its native config format. The setting
**identity** (name and meaning) is identical across all clients; the
**syntax** differs by client.

| Client | Setting key (native) | Format | Schema file |
|--------|---------------------|--------|-------------|
| VS Code | `leo.languageServer.path` / `leo.languageServer.args` | `package.json:contributes.configuration` | `packages/vscode/package.json:55-72` |
| Cursor | (inherits VS Code) | same `package.json` | same |
| Antigravity | (inherits VS Code) | same `package.json` | same |
| Zed | `lsp.leo-lsp.binary.path` / `lsp.leo-lsp.binary.arguments` | `extension.toml` + workspace `settings.json` under top-level `lsp` key (Zed convention; see [Zed docs — Language Server Configuration](https://zed.dev/docs/configuring-zed#language-servers)) | `packages/zed/extension.toml` + PR 3 §6 |
| Sublime Text | `binary_path` / `args` | `LSP-leo.sublime-settings` (LSP package convention; matches `LSP-clangd` and `LSP-SourceKit`) | `packages/sublime/LSP-leo/LSP-leo.sublime-settings` + PR 6 §6 |
| IntelliJ | `languageServerPath` / `languageServerArgs` (camelCase Kotlin fields; xmlb serialization requires this form) | `<application>` `<component>` state in `idea.config.path` (JetBrains `PersistentStateComponent`) | `packages/intellij/src/main/kotlin/com/aleo/leo/settings/LeoSettings.kt` + PR 7 §6 |
| Claude Code LSP | **no user-configurable surface** (`.lsp.json` does not support `${user_config.*}` substitution as of v2.0.74; gap tracked in PR 4 §9) | n/a | PR 4 §6 |
| Codex LSP | `LEO_LSP_PATH` env var via `[plugins."leo@…".mcp_servers.leo.env]` (forced by Codex's MCP plugin config shape; no equivalent of `args`) | `~/.codex/config.toml` | PR 5 §6 |
| Compiler Explorer | n/a — CE invokes the `leo` compiler binary directly, not `leo-lsp` | `compilers.leo.exe` in CE `etc/config/leo.amazon.properties` | upstream CE config |

### Encoding rules per client

- **VS Code / Cursor / Antigravity**: map directly to
  `leo.languageServer.path` and `leo.languageServer.args` in
  `contributes.configuration`.
- **Zed** (`zed_extension_api::settings::CommandSettings`): `path` →
  `binary.path`, `args` → `binary.arguments`. Forced renames.
- **Sublime Text** (`sublimelsp/LSP` package convention): `path` →
  `binary_path`, `args` → `args`. Matches `LSP-clangd` /
  `LSP-SourceKit`.
- **IntelliJ** (`PersistentStateComponent` xmlb serializer): `path` →
  `languageServerPath`, `args` → `languageServerArgs`. Forced camelCase.
- **Claude Code LSP**: no native user-configurable surface today.
  Discovery is `$PATH` only via the plugin's `.lsp.json`. Adding a
  configurable path is roadmap work upstream in Claude Code; PR 4 §9
  carries the gap.
- **Codex LSP**: no native equivalent of `path` and `args`. The MCP
  bridge reads `LEO_LSP_PATH` (set via `mcp_servers.leo.env` in
  `~/.codex/config.toml`) as the closest analogue of `path`; no
  analogue of `args` exists.
- **Compiler Explorer** does not run `leo-lsp` at all; CE is a one-shot
  compile-and-render integration. The `leo.languageServer.*` schema does
  not apply.

## Stability guarantees

These two field names + defaults + types are part of the public API of every
Leo client. Renaming, retyping, or changing the discovery fallback is a
breaking change that requires a bump in `engines.vscode` and a deprecation
notice in each client's `README.md`. Adding optional sibling keys (e.g.
`leo.languageServer.trace`) is non-breaking.
