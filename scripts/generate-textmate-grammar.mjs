#!/usr/bin/env node

// Generates the shipped VS Code TextMate grammar from Leo's tree-sitter source.
// - Reads Leo grammar data from a sibling or specified `leo` checkout at a git ref.
// - Uses `tree-sitter/src/grammar.json` plus `queries/highlights.scm` as inputs.
// - Rebuilds `packages/vscode/syntaxes/leo.tmLanguage.json`.
// - Refreshes `packages/vscode/generated-from-leo.json` with the source ref/commit.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const leoRepo = resolveArg(
  readOption("--leo-repo"),
  path.join(repoRoot, "../leo")
);
const leoRef = readOption("--leo-ref") ?? "HEAD";
const outputPath = resolveArg(
  readOption("--output"),
  path.join(repoRoot, "packages/vscode/syntaxes/leo.tmLanguage.json")
);
const metadataPath = resolveArg(
  readOption("--metadata"),
  path.join(repoRoot, "packages/vscode/generated-from-leo.json")
);

const resolvedCommit = readLeoFile("rev-parse", "--verify", `${leoRef}^{commit}`).trim();
readLeoFile("cat-file", "-e", `${leoRef}:tree-sitter/src/grammar.json`);
readLeoFile("cat-file", "-e", `${leoRef}:tree-sitter/queries/highlights.scm`);

const highlightsQuery = readLeoFile("show", `${leoRef}:tree-sitter/queries/highlights.scm`);
const grammar = JSON.parse(readLeoFile("show", `${leoRef}:tree-sitter/src/grammar.json`));

const captureStrings = collectCaptureStrings(highlightsQuery);
const nameCaptureParents = collectNameCaptureParents(highlightsQuery);
const identifierPattern = unwrapPattern(getRule(grammar, "identifier"));
const keywordTokens = captureStrings.get("keyword") ?? [];
const primitiveTypes = extractStringChoices(getRule(grammar, "primitive_type"));
const numberPatterns = [
  ...extractPatternChoices(getRule(grammar, "integer_literal")),
  ...extractPatternChoices(getRule(grammar, "field_literal")),
  ...extractPatternChoices(getRule(grammar, "group_literal")),
  ...extractPatternChoices(getRule(grammar, "scalar_literal"))
];
const stringPattern = unwrapPattern(getRule(grammar, "string_literal"));
const addressPattern = unwrapPattern(getRule(grammar, "address_literal"));
const lineCommentPattern = unwrapPattern(getRule(grammar, "line_comment"));
const blockCommentPattern = buildSequencePattern(getRule(grammar, "block_comment"));
const builtinConstantTokens = [
  ...extractStringChoices(getRule(grammar, "boolean_literal")),
  ...extractStringChoices(getRule(grammar, "none_literal"))
];
const specialPathPatterns = extractPatternChoices(getRule(grammar, "special_path"));

const textMateGrammar = {
  name: "Leo",
  scopeName: "source.leo",
  fileTypes: ["leo"],
  patterns: [
    { include: "#comments" },
    { include: "#annotations" },
    { include: "#strings" },
    { include: "#numbers" },
    { include: "#addresses" },
    { include: "#programDeclarations" },
    { include: "#typeDeclarations" },
    { include: "#functionDeclarations" },
    { include: "#keywords" },
    { include: "#types" },
    { include: "#constants" },
    { include: "#operators" },
    { include: "#punctuation" }
  ],
  repository: {
    comments: {
      patterns: [
        {
          name: "comment.line.double-slash.leo",
          match: lineCommentPattern
        },
        {
          name: "comment.block.leo",
          match: blockCommentPattern
        }
      ]
    },
    annotations: {
      patterns: [
        {
          name: "entity.other.attribute-name.leo",
          match: `@(?:${identifierPattern})`
        }
      ]
    },
    strings: {
      patterns: [
        {
          name: "string.quoted.double.leo",
          match: stringPattern
        }
      ]
    },
    numbers: {
      patterns: numberPatterns.length === 0 ? [] : [
        {
          name: "constant.numeric.leo",
          match: rawAlternation(numberPatterns)
        }
      ]
    },
    addresses: {
      patterns: [
        {
          name: "string.special.address.leo",
          match: addressPattern
        }
      ]
    },
    programDeclarations: {
      patterns: buildDeclarationPatterns(nameCaptureParents.get("namespace") ?? [], identifierPattern)
    },
    typeDeclarations: {
      patterns: buildDeclarationPatterns(nameCaptureParents.get("type") ?? [], identifierPattern)
    },
    functionDeclarations: {
      patterns: [
        ...buildDeclarationPatterns(nameCaptureParents.get("function") ?? [], identifierPattern),
        ...(captureStrings.get("function")?.includes("constructor")
          ? [
              {
                name: "meta.declaration.function.constructor.leo",
                match: "\\bconstructor\\b",
                captures: {
                  0: {
                    name: "keyword.declaration.function.leo"
                  }
                }
              }
            ]
          : [])
      ]
    },
    keywords: {
      patterns: keywordTokens.length === 0 ? [] : [
        {
          name: "keyword.control.leo",
          match: wordAlternation(keywordTokens)
        }
      ]
    },
    types: {
      patterns: primitiveTypes.length === 0 ? [] : [
        {
          name: "storage.type.primitive.leo",
          match: wordAlternation(primitiveTypes)
        }
      ]
    },
    constants: {
      patterns: [
        ...(builtinConstantTokens.length === 0
          ? []
          : [
              {
                name: "constant.language.leo",
                match: wordAlternation(builtinConstantTokens)
              }
            ]),
        ...(specialPathPatterns.length === 0
          ? []
          : [
              {
                name: "constant.language.special-path.leo",
                match: rawAlternation(specialPathPatterns)
              }
            ])
      ]
    },
    operators: {
      patterns: (captureStrings.get("operator") ?? []).length === 0 ? [] : [
        {
          name: "keyword.operator.leo",
          match: plainAlternation(captureStrings.get("operator") ?? [])
        }
      ]
    },
    punctuation: {
      patterns: buildPunctuationPatterns(captureStrings)
    }
  }
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(textMateGrammar, null, 2)}\n`);

const metadata = {
  sourceRepo: "ProvableHQ/leo",
  sourcePath: "tree-sitter",
  sourceRef: leoRef,
  resolvedCommit
};

fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

function resolveArg(value, fallback) {
  return value ? path.resolve(process.cwd(), value) : fallback;
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function readLeoFile(...args) {
  return execFileSync("git", ["-C", leoRepo, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function collectCaptureStrings(query) {
  const valuesByCapture = new Map();

  for (const match of query.matchAll(/\[((?:.|\n)*?)\]\s*@([A-Za-z0-9._-]+)/g)) {
    const [, groupContent, capture] = match;
    for (const stringValue of extractQuotedStrings(groupContent)) {
      pushUnique(valuesByCapture, capture, stringValue);
    }
  }

  for (const match of query.matchAll(/"((?:\\.|[^"])*)"\s*@([A-Za-z0-9._-]+)/g)) {
    const [, literal, capture] = match;
    pushUnique(valuesByCapture, capture, literal);
  }

  return valuesByCapture;
}

function collectNameCaptureParents(query) {
  const parentsByCapture = new Map();
  const regex = /\(([A-Za-z0-9_]+)\s+name:\s+\(([A-Za-z0-9_]+)\)\s*@([A-Za-z0-9._-]+)\)/g;

  for (const match of query.matchAll(regex)) {
    const [, parentType, , capture] = match;
    pushUnique(parentsByCapture, capture, parentType);
  }

  return parentsByCapture;
}

function extractQuotedStrings(text) {
  return Array.from(text.matchAll(/'((?:\\.|[^'])*)'|"((?:\\.|[^"])*)"/g), match => match[1] || match[2]);
}

function buildDeclarationPatterns(parentTypes, identifierPattern) {
  const patterns = [];

  for (const parentType of parentTypes) {
    const pattern = declarationPatternFor(parentType, identifierPattern);
    if (pattern) {
      patterns.push(pattern);
    }
  }

  return patterns;
}

function declarationPatternFor(parentType, identifierPattern) {
  switch (parentType) {
    case "program_declaration":
    case "import_declaration": {
      const keyword = parentType === "program_declaration" ? "program" : "import";
      return {
        name: "meta.declaration.program.leo",
        match: `\\b(${keyword})\\s+(${identifierPattern})\\.(aleo)\\b`,
        captures: {
          1: {
            name: "keyword.declaration.namespace.leo"
          },
          2: {
            name: "entity.name.namespace.leo"
          },
          3: {
            name: "keyword.other.leo"
          }
        }
      };
    }
    case "struct_definition":
    case "record_definition":
    case "interface_declaration": {
      const keyword = parentType.replace(/_(definition|declaration)$/, "").replace(/_/g, " ");
      return {
        name: "meta.declaration.type.leo",
        match: `\\b(${escapeRegex(keyword)})\\s+(${identifierPattern})\\b`,
        captures: {
          1: {
            name: "keyword.declaration.type.leo"
          },
          2: {
            name: "entity.name.type.leo"
          }
        }
      };
    }
    case "function_definition":
    case "final_function_definition": {
      const keyword = parentType === "final_function_definition" ? "final\\s+fn" : "fn";
      return {
        name: "meta.declaration.function.leo",
        match: `\\b(${keyword})\\s+(${identifierPattern})\\b`,
        captures: {
          1: {
            name: "keyword.declaration.function.leo"
          },
          2: {
            name: "entity.name.function.leo"
          }
        }
      };
    }
    default:
      return null;
  }
}

function buildPunctuationPatterns(captureStrings) {
  const patterns = [];
  const bracketTokens = captureStrings.get("punctuation.bracket") ?? [];
  const delimiterTokens = captureStrings.get("punctuation.delimiter") ?? [];

  if (bracketTokens.length > 0) {
    patterns.push({
      name: "punctuation.bracket.leo",
      match: plainAlternation(bracketTokens)
    });
  }

  if (delimiterTokens.length > 0) {
    patterns.push({
      name: "punctuation.delimiter.leo",
      match: plainAlternation(delimiterTokens)
    });
  }

  return patterns;
}

function wordAlternation(values) {
  return `\\b(?:${sortForRegex(values).map(escapeRegex).join("|")})\\b`;
}

function plainAlternation(values) {
  return `(?:${sortForRegex(values).map(escapeRegex).join("|")})`;
}

function rawAlternation(values) {
  return `(?:${sortForRegex(values).join("|")})`;
}

function sortForRegex(values) {
  return [...new Set(values)].sort((left, right) => right.length - left.length || left.localeCompare(right));
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}

function pushUnique(map, key, value) {
  const existing = map.get(key) ?? [];
  if (!existing.includes(value)) {
    existing.push(value);
    map.set(key, existing);
  }
}

function getRule(grammar, ruleName) {
  const rule = grammar?.rules?.[ruleName];
  if (!rule) {
    throw new Error(`Unable to find '${ruleName}' in tree-sitter/src/grammar.json`);
  }

  return rule;
}

function unwrapPattern(rule) {
  const unwrapped = unwrapRule(rule);
  if (unwrapped.type !== "PATTERN") {
    throw new Error(`Expected rule to resolve to PATTERN, received '${unwrapped.type}'.`);
  }

  return unwrapped.value;
}

function extractStringChoices(rule) {
  const values = [];
  visitRule(unwrapRule(rule), entry => {
    if (entry.type === "STRING") {
      values.push(entry.value);
    }
  });
  return [...new Set(values)];
}

function extractPatternChoices(rule) {
  const values = [];
  visitRule(unwrapRule(rule), entry => {
    if (entry.type === "PATTERN") {
      values.push(entry.value);
    }
  });
  return [...new Set(values)];
}

function buildSequencePattern(rule) {
  const unwrapped = unwrapRule(rule);
  if (unwrapped.type !== "SEQ") {
    throw new Error(`Expected rule to resolve to SEQ, received '${unwrapped.type}'.`);
  }

  return unwrapped.members.map(member => patternFragmentFor(member)).join("");
}

function patternFragmentFor(rule) {
  const unwrapped = unwrapRule(rule);

  switch (unwrapped.type) {
    case "STRING":
      return escapeRegex(unwrapped.value);
    case "PATTERN":
      return unwrapped.value;
    default:
      throw new Error(`Unsupported sequence member '${unwrapped.type}' in grammar.json conversion.`);
  }
}

function unwrapRule(rule) {
  if (rule.type === "TOKEN") {
    return unwrapRule(rule.content);
  }

  if (rule.type === "PREC") {
    return unwrapRule(rule.content);
  }

  return rule;
}

function visitRule(rule, visitor) {
  visitor(rule);

  if (Array.isArray(rule.members)) {
    for (const member of rule.members) {
      visitRule(member, visitor);
    }
  }

  if (rule.content && typeof rule.content === "object") {
    visitRule(rule.content, visitor);
  }
}
