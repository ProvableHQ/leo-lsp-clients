import {
  escapeRegex,
  mixedAlternation,
  plainAlternation,
  rawAlternation,
  wordAlternation
} from "./leo-syntax-data.mjs";

export function buildPrismGrammarSource(syntaxData) {
  const sourceRef = syntaxData.metadata.sourceRef || "unknown";
  const resolvedCommit = syntaxData.metadata.resolvedCommit || "unknown";
  const grammar = buildPrismGrammar(syntaxData);

  return [
    "// Generated from Leo tree-sitter syntax data. Do not edit by hand.",
    `// Source repo: ${syntaxData.metadata.sourceRepo}`,
    `// Source ref: ${sourceRef}`,
    `// Resolved commit: ${resolvedCommit}`,
    "",
    `Prism.languages.leo = ${formatJsValue(grammar)};`,
    ""
  ].join("\n");
}

function buildPrismGrammar(syntaxData) {
  const grammar = {};
  const keywordTokens = syntaxData.keywordTokens.filter(
    token => !syntaxData.visibilityTokens.includes(token) && token !== "constructor"
  );

  grammar.comment = [
    {
      pattern: raw(regexExpression(`(^|[^\\\\:])${syntaxData.lineCommentPattern}`)),
      lookbehind: true,
      greedy: true
    },
    {
      pattern: raw(regexExpression(`(^|[^\\\\])${syntaxData.blockCommentPattern}`)),
      lookbehind: true,
      greedy: true
    }
  ];
  grammar.annotation = {
    pattern: raw(regexExpression(`@(?:${syntaxData.identifierPattern})`)),
    alias: "annotation"
  };
  grammar.string = [
    {
      pattern: raw(regexExpression(syntaxData.stringPattern)),
      greedy: true
    }
  ];
  grammar.address = {
    pattern: raw(regexExpression(syntaxData.addressPattern)),
    alias: "string"
  };

  if (syntaxData.numberPatterns.length > 0) {
    grammar.number = {
      pattern: raw(regexExpression(boundedTokenPattern(rawAlternation(syntaxData.numberPatterns)))),
      lookbehind: true
    };
  }

  grammar["program-id"] = {
    pattern: raw(regexExpression(`\\b${syntaxData.programIdPattern}\\b`)),
    alias: "file",
    inside: {
      punctuation: raw(regexExpression("\\.")),
      keyword: raw(regexExpression("\\baleo\\b"))
    }
  };

  if (syntaxData.visibilityTokens.length > 0) {
    grammar.visibility = raw(regexExpression(wordAlternation(syntaxData.visibilityTokens)));
  }

  const typeNamePatterns = buildTypeNamePatterns(syntaxData);
  if (typeNamePatterns.length > 0) {
    grammar["type-name"] = typeNamePatterns;
  }

  if (keywordTokens.length > 0) {
    grammar.keyword = raw(regexExpression(wordAlternation(keywordTokens)));
  }

  if (syntaxData.primitiveTypes.length > 0) {
    grammar["type-keyword"] = raw(regexExpression(wordAlternation(syntaxData.primitiveTypes)));
  }

  if (syntaxData.booleanTokens.length > 0) {
    grammar["bool-keyword"] = raw(regexExpression(wordAlternation(syntaxData.booleanTokens)));
  }

  const builtinPatterns = buildBuiltinConstantPatterns(syntaxData);
  if (builtinPatterns.length > 0) {
    grammar["builtin-constant"] = builtinPatterns.length === 1 ? builtinPatterns[0] : builtinPatterns;
  }

  const functionPatterns = buildFunctionPatterns(syntaxData);
  if (functionPatterns.length > 0) {
    grammar.function = functionPatterns;
  }

  if (syntaxData.operatorTokens.length > 0) {
    grammar.operator = raw(regexExpression(mixedAlternation(syntaxData.operatorTokens)));
  }

  const punctuationPattern = buildPunctuationPattern(syntaxData);
  if (punctuationPattern) {
    grammar.punctuation = raw(regexExpression(punctuationPattern));
  }

  return grammar;
}

function buildTypeNamePatterns(syntaxData) {
  const patterns = [];
  const typeParents = syntaxData.nameCaptureParents.get("type") ?? [];

  for (const parentType of typeParents) {
    const keyword = typeKeywordForParent(parentType);
    if (!keyword) {
      continue;
    }

    patterns.push({
      pattern: raw(regexExpression(`\\b${escapeRegex(keyword)}\\s+(?:${syntaxData.identifierPattern})\\b`)),
      inside: {
        keyword: raw(regexExpression(`\\b${escapeRegex(keyword)}\\b`)),
        "type-name": {
          pattern: raw(regexExpression(syntaxData.identifierPattern)),
          alias: "class-name"
        }
      }
    });
  }

  return patterns;
}

function typeKeywordForParent(parentType) {
  switch (parentType) {
    case "struct_definition":
      return "struct";
    case "record_definition":
      return "record";
    case "interface_declaration":
      return "interface";
    default:
      return null;
  }
}

function buildBuiltinConstantPatterns(syntaxData) {
  const patterns = [];

  if (syntaxData.noneTokens.length > 0) {
    patterns.push({
      pattern: raw(regexExpression(wordAlternation(syntaxData.noneTokens))),
      alias: "constant"
    });
  }

  if (syntaxData.specialPathPatterns.length > 0) {
    patterns.push({
      pattern: raw(regexExpression(rawAlternation(syntaxData.specialPathPatterns))),
      alias: "constant"
    });
  }

  return patterns;
}

function buildFunctionPatterns(syntaxData) {
  const patterns = [];

  if ((syntaxData.captureStrings.get("function") ?? []).includes("constructor")) {
    patterns.push({
      pattern: raw(regexExpression("\\bconstructor\\b")),
      alias: "function"
    });
  }

  patterns.push(raw(regexExpression(`(?:${syntaxData.identifierPattern})(?=\\s*(?:\\(|::\\[))`)));

  return patterns;
}

function buildPunctuationPattern(syntaxData) {
  const punctuationTokens = [
    ...syntaxData.punctuationBracketTokens,
    ...syntaxData.punctuationDelimiterTokens
  ];

  if (punctuationTokens.length === 0) {
    return "";
  }

  return plainAlternation(punctuationTokens);
}

function boundedTokenPattern(pattern) {
  return `(^|[^A-Za-z0-9_])(?:${pattern})(?![A-Za-z0-9_])`;
}

function raw(value) {
  return {
    __raw: value
  };
}

function regexExpression(pattern, flags = "") {
  return flags.length === 0
    ? `new RegExp(${JSON.stringify(pattern)})`
    : `new RegExp(${JSON.stringify(pattern)}, ${JSON.stringify(flags)})`;
}

function formatJsValue(value, indentLevel = 0) {
  if (value && typeof value === "object" && value.__raw) {
    return value.__raw;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    const indent = "  ".repeat(indentLevel);
    const nextIndent = "  ".repeat(indentLevel + 1);

    return `[\n${value.map(item => `${nextIndent}${formatJsValue(item, indentLevel + 1)}`).join(",\n")}\n${indent}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return "{}";
    }

    const indent = "  ".repeat(indentLevel);
    const nextIndent = "  ".repeat(indentLevel + 1);

    return `{\n${entries
      .map(([key, entryValue]) => `${nextIndent}${JSON.stringify(key)}: ${formatJsValue(entryValue, indentLevel + 1)}`)
      .join(",\n")}\n${indent}}`;
  }

  return JSON.stringify(value);
}
