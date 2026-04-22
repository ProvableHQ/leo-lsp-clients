import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function loadGrammar() {
  const grammarPath = require.resolve("../packages/shared/syntaxes/prism-leo.js");

  delete require.cache[grammarPath];
  globalThis.Prism = { languages: {} };
  require(grammarPath);
  return globalThis.Prism.languages.leo;
}

function tokenPattern(entry) {
  return entry?.pattern ?? entry ?? null;
}

test("number tokens do not match inside identifiers or type names", () => {
  const grammar = loadGrammar();
  const numberPattern = tokenPattern(grammar.number);

  assert.ok(numberPattern);

  for (const sample of [
    "u8",
    "u16",
    "identifier",
    "ARC20",
    "S2",
    "SHA3_384",
    "hash_to_u8",
    "sign195m229jvzr0wmnshj6f8gwplhkrkhjumgjmad553r997u7pjfgpfz4j2w0c9lp53mcqqdsm",
    "external_program.aleo::S2"
  ]) {
    assert.equal(numberPattern.exec(sample), null, `${sample} should not contain a Prism number match`);
  }
});

test("numeric literals still match as numbers", () => {
  const grammar = loadGrammar();
  const numberPattern = tokenPattern(grammar.number);

  assert.ok(numberPattern);

  for (const sample of ["2u8", "1field", "2u32", "0x10u16"]) {
    assert.equal(numberPattern.exec(sample)?.[0], sample, `${sample} should remain a Prism number match`);
  }
});

test("primitive types continue to match as type keywords", () => {
  const grammar = loadGrammar();
  const typeKeywordPattern = tokenPattern(grammar["type-keyword"]);

  assert.ok(typeKeywordPattern);

  for (const sample of ["u8", "u16", "signature", "address"]) {
    assert.equal(typeKeywordPattern.exec(sample)?.[0], sample, `${sample} should remain a type keyword`);
  }
});
