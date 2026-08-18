# Contributing

This repository contains IDE integrations and language tooling clients for Leo.

## VS Code Extension

The VS Code extension lives in `packages/vscode`.

Build the extension:

```bash
npm run build --workspace leo-extension
```

Create a local VSIX:

```bash
npm run package:vscode
```

## Local Leo LSP Testing

For local language-server validation, install the supported `leo-lsp` version:

```bash
cargo install leo-lsp --version 4.4.1 --locked
leo-lsp --version
```

The executable must be available on `PATH`. You can also set `leo.languageServer.path` to its absolute path.

When the extension finds `leo-lsp`, it starts the Rust language server over stdio. When it does not find the binary, the extension uses its tree-sitter-derived fallback mode.
