#!/usr/bin/env node

// Generates the shared Leo Prism component from Leo's tree-sitter source.
// - Reads Leo grammar data from a sibling or specified `leo` checkout at a git ref.
// - Uses `tree-sitter/src/grammar.json` plus `queries/highlights.scm` as inputs.
// - Rebuilds `packages/shared/syntaxes/prism-leo.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPrismGrammarSource } from "./lib/prism-emitter.mjs";
import { extractLeoSyntaxData } from "./lib/leo-syntax-data.mjs";
import { loadLeoTreeSitterSource, readOption, resolveArg } from "./lib/leo-tree-sitter-source.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const source = loadLeoTreeSitterSource({
  repoRoot,
  defaultLeoRepo: path.join(repoRoot, "../leo"),
  defaultLeoRef: "HEAD"
});
const outputPath = resolveArg(
  readOption("--output"),
  path.join(repoRoot, "packages/shared/syntaxes/prism-leo.js")
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, buildPrismGrammarSource(extractLeoSyntaxData(source)));
