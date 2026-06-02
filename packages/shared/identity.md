# Identity canon

Every Leo client manifest references the values in this file. Do not invent
new strings; do not change a value here without updating every client.

## Vendor

| Field | Value |
|-------|-------|
| Vendor (legal) | `Provable Inc.` |
| Vendor (display) | `Provable` |
| Support email | `support@provable.com` |
| Homepage | `https://provable.com` |
| Language site | `https://leo-lang.org` |
| Code repository | `https://github.com/ProvableHQ/leo-lsp-clients` |
| Issue tracker | `https://github.com/ProvableHQ/leo-lsp-clients/issues` |

The prior audit found six divergent strings across the existing eight PR
specs (`Aleo Systems`, `AleoHQ`, `aleohq`, `Provable`, `Provable HQ`,
`provable-inc`). This table is the resolution. Where a marketplace handle
predates this canon (e.g. VS Code Marketplace `publisher: aleohq`, see §9),
the handle is retained for continuity but the **display vendor** is
`Provable Inc.` in every README, `LICENSE` header, and `description`
metadata field.

**Documented exception — Zed package (`packages/zed`).** The Zed extension's
`authors` field, in both `Cargo.toml` and `extension.toml`, uses the upstream
Leo Rust crate string `The Leo Team <leo@provable.com>` (as in `leo-lsp` /
`leo-compiler`) rather than the `Provable Inc.` vendor above. This is a
deliberate choice so the Zed crate + manifest match the upstream `ProvableHQ/leo`
metadata it is published alongside. The `Provable Inc.` display vendor still
applies to every other client's README/description/license surfaces.

## Language

| Field | Value |
|-------|-------|
| Language id | `leo` (lowercase) |
| Display name | `Leo` |
| File extension(s) | `.leo` |
| MIME-style description | `Leo source file` |

## Server binary

| Field | Value |
|-------|-------|
| Binary name (unix) | `leo-lsp` |
| Binary name (windows) | `leo-lsp.exe` |
| Source repository | `https://github.com/ProvableHQ/leo` |
| Install via cargo | `cargo install --git https://github.com/ProvableHQ/leo leo-lsp` |

## Syntax / grammar

| Field | Value |
|-------|-------|
| TextMate scope | `source.leo` |
| Tree-sitter language name | `leo` |
| Prism component id | `leo` |

## Marketplace / package IDs

| Marketplace | Package ID | Owner handle | Notes |
|-------------|------------|--------------|-------|
| VS Code Marketplace | `aleohq.leo-extension` | `aleohq` | Historical; do not rebrand without a deprecation period. |
| Open VSX (Cursor / Antigravity / Zed extensions hub) | `aleohq.leo-extension` | `aleohq` (namespace) | Mirror of VS Code Marketplace. |
| JetBrains Marketplace | `com.aleo.leo` | Aleo | New listing in PR 7. Keeps the `aleo` prefix for consistency with the VS Code `aleohq.leo-extension` handle (whose rename is deferred — see §9). |
| Sublime Package Control | `LSP-leo` | ProvableHQ | New listing in PR 6. |
| Zed Extensions | `leo` | ProvableHQ | New listing in PR 3. |

Rename of `aleohq` → `provable-inc` on the VS Code Marketplace and Open VSX
is out of scope for PR 0 and is explicitly deferred. See §9.
