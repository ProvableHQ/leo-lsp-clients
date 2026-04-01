#!/usr/bin/env node

// Generates Leo syntax artifacts from the upstream tree-sitter source.
// - Reads Leo grammar data from a sibling or specified `leo` checkout at a git ref.
// - Uses `tree-sitter/src/grammar.json` plus `queries/highlights.scm` as inputs.
// - Rebuilds the shipped VS Code TextMate grammar and the shared Prism component.
// - Refreshes `packages/vscode/generated-from-leo.json` with the source ref/commit.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPrismGrammarSource } from "./lib/prism-emitter.mjs";
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
const textMateOutputPath = resolveArg(
  readOption("--textmate-output"),
  path.join(repoRoot, "packages/vscode/syntaxes/leo.tmLanguage.json")
);
const prismOutputPath = resolveArg(
  readOption("--prism-output"),
  path.join(repoRoot, "packages/shared/syntaxes/prism-leo.js")
);
const metadataPath = resolveArg(
  readOption("--metadata"),
  path.join(repoRoot, "packages/vscode/generated-from-leo.json")
);

writeTextFile(textMateOutputPath, `${JSON.stringify(buildTextMateGrammar(syntaxData), null, 2)}\n`);
writeTextFile(prismOutputPath, buildPrismGrammarSource(syntaxData));
writeTextFile(metadataPath, `${JSON.stringify(syntaxData.metadata, null, 2)}\n`);

function writeTextFile(outputPath, contents) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, contents);
}
