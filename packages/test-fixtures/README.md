# test-fixtures

Small Leo programs used by tests and smoke harnesses.

## What's here

- `samples/counter.leo` — single-file fixture. The canonical "open a Leo file" smoke target.
- `samples/two-file/` — minimal cross-file Leo package layout. `two_file_main` imports `two_file_add.aleo` via a declared local dependency, so `leo-lsp` can resolve `::add` in `two_file_main/src/main.leo` to its definition in `two_file_add/src/main.leo`. Each subdirectory is a complete Leo package (its own `program.json`, source under `src/`) — flat files in one directory don't work because `leo-lsp` discovers packages by walking up for `program.json`.
- `samples/prism-regressions.leo` — input for the Prism grammar regression test (`npm run test:prism`). Not a positional fixture.

Keep new fixtures small, syntactically valid, and self-contained.

## Coordinate table

The per-client harnesses cite this table when they assert a position. Both
0-indexed (VS Code `Position`) and 1-indexed (`leo-lsp-smoke` CLI) values are
listed so the call sites don't re-derive them.

| Fixture                  | Symbol                  | 0-indexed (line, char) | 1-indexed (line, char) |
|--------------------------|-------------------------|------------------------|------------------------|
| `samples/counter.leo`    | `increment` declaration | `(3, 7)`               | `(4, 8)`               |
