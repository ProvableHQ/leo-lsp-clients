# Leo for Zed

Leo language support for the [Zed editor](https://zed.dev): tree-sitter syntax
highlighting, bracket matching, an outline panel, auto-indent, and integration
with the `leo-lsp` language server (go-to-definition, find references, rename,
diagnostics) for [Aleo](https://aleo.org) smart contracts written in
[Leo](https://leo-lang.org).

## Install

1. Install the extension from Zed's extension registry: open the command
   palette (`cmd-shift-p`) → **zed: extensions** → search **Leo** → Install.
2. Install the language server so Zed can start it:

   ```bash
   cargo install --git https://github.com/ProvableHQ/leo leo-lsp --locked
   ```

   This places `leo-lsp` in `~/.cargo/bin`, which is on your `PATH` by default.

Open any `.leo` file. Syntax highlighting works immediately. If `leo-lsp` is
found, Zed starts it and you get the full language-server feature set. If it is
not found, highlighting/brackets/outline still work and Zed shows a one-line
status explaining how to install or configure the server.

## Configuring the server binary

Syntax features need no configuration. To point Zed at a specific `leo-lsp`
binary (for example a local debug build, or an install that is not on your
`PATH`), set it in your Zed `settings.json` (per-user
`~/.config/zed/settings.json`, or per-project `<project>/.zed/settings.json`):

```json
{
  "lsp": {
    "leo-lsp": {
      "binary": {
        "path": "/absolute/path/to/leo-lsp",
        "arguments": [],
        "env": { "RUST_LOG": "info" }
      }
    }
  }
}
```

- `binary.path` accepts an absolute path or a path relative to the project root.
- This is the same `lsp.<server>.binary` surface every Zed language server uses
  (e.g. `rust-analyzer`). It maps to the canonical `leo.languageServer.path` /
  `leo.languageServer.args` settings shared across all Leo editor clients; see
  [`packages/shared/config-schema.md`](../shared/config-schema.md).

### Discovery order

1. `lsp.leo-lsp.binary.path` from your Zed settings (absolute or project-relative).
2. The first `leo-lsp` found on `PATH`.

If neither resolves, the server is skipped (with a status message) and the
tree-sitter features keep working. Zed's discovery is intentionally narrower
than the VS Code client's (no `$CARGO_HOME`/`target/` probing) because the
WebAssembly extension sandbox cannot run an external discovery process; install
`leo-lsp` on `PATH` or set `binary.path`.

After changing settings, run **zed: restart language server** from the command
palette.

## Logs

- LSP traffic: command palette → **zed: open language server logs**.
- Server stderr is captured into `~/Library/Logs/Zed/Zed.log`.

## License

GPL-3.0, consistent with the Leo compiler and the other Leo editor clients in
this repository. See [`LICENSE.txt`](./LICENSE.txt).
