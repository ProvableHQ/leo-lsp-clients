#!/usr/bin/env node

// Generates the shipped VS Code TextMate grammar from Leo's tree-sitter source.
// - Reads Leo grammar data from a sibling or specified `leo` checkout at a git ref.
// - Uses `tree-sitter/src/grammar.json` plus `queries/highlights.scm` as inputs.
// - Rebuilds `packages/vscode/syntaxes/leo.tmLanguage.json`.
// - Refreshes `packages/vscode/generated-from-leo.json` with the source ref/commit.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractLeoSyntaxData } from "./lib/leo-syntax-data.mjs";
import { loadLeoTreeSitterSource, readOption, resolveArg } from "./lib/leo-tree-sitter-source.mjs";
import { buildTextMateGrammar } from "./lib/textmate-emitter.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const source = loadLeoTreeSitterSource({
  repoRoot,
  defaultLeoRepo: path.join(repoRoot, "../leo"),
  defaultLeoRef: "HEAD"
});
const syntaxData = extractLeoSyntaxData(source);
const outputPath = resolveArg(
  readOption("--output"),
  path.join(repoRoot, "packages/shared/syntaxes/leo.tmLanguage.json")
);
const metadataPath = resolveArg(
  readOption("--metadata"),
  path.join(repoRoot, "packages/vscode/generated-from-leo.json")
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(buildTextMateGrammar(syntaxData), null, 2)}\n`);

fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
fs.writeFileSync(metadataPath, `${JSON.stringify(syntaxData.metadata, null, 2)}\n`);
