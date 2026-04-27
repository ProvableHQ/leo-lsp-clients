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

For local language-server validation, install `leo-lsp` so the executable is
available on `PATH`, or point the extension at it explicitly with the
`leo.languageServer.path` setting.

When the extension finds `leo-lsp`, it starts the Rust language server over
stdio. When it does not find the binary, the extension stays in its
tree-sitter-derived fallback mode instead of failing activation.
