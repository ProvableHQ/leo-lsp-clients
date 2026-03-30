export function extractLeoSyntaxData({ grammar, highlightsQuery, metadata }) {
  const captureStrings = collectCaptureStrings(highlightsQuery);
  const nameCaptureParents = collectNameCaptureParents(highlightsQuery);
  const identifierPattern = unwrapPattern(getRule(grammar, "identifier"));

  return {
    metadata,
    captureStrings,
    nameCaptureParents,
    identifierPattern,
    programIdPattern: `(?:${identifierPattern})\\.aleo`,
    keywordTokens: captureStrings.get("keyword") ?? [],
    primitiveTypes: extractStringChoices(getRule(grammar, "primitive_type")),
    visibilityTokens: extractStringChoices(getRule(grammar, "visibility")),
    booleanTokens: extractStringChoices(getRule(grammar, "boolean_literal")),
    noneTokens: extractStringChoices(getRule(grammar, "none_literal")),
    numberPatterns: [
      ...extractPatternChoices(getRule(grammar, "integer_literal")),
      ...extractPatternChoices(getRule(grammar, "field_literal")),
      ...extractPatternChoices(getRule(grammar, "group_literal")),
      ...extractPatternChoices(getRule(grammar, "scalar_literal"))
    ],
    stringPattern: unwrapPattern(getRule(grammar, "string_literal")),
    addressPattern: unwrapPattern(getRule(grammar, "address_literal")),
    lineCommentPattern: unwrapPattern(getRule(grammar, "line_comment")),
    blockCommentPattern: buildSequencePattern(getRule(grammar, "block_comment")),
    builtinConstantTokens: [
      ...extractStringChoices(getRule(grammar, "boolean_literal")),
      ...extractStringChoices(getRule(grammar, "none_literal"))
    ],
    specialPathPatterns: extractPatternChoices(getRule(grammar, "special_path")),
    operatorTokens: captureStrings.get("operator") ?? [],
    punctuationBracketTokens: captureStrings.get("punctuation.bracket") ?? [],
    punctuationDelimiterTokens: captureStrings.get("punctuation.delimiter") ?? []
  };
}

export function wordAlternation(values) {
  return `\\b(?:${sortForRegex(values).map(escapeRegex).join("|")})\\b`;
}

export function plainAlternation(values) {
  return `(?:${sortForRegex(values).map(escapeRegex).join("|")})`;
}

export function rawAlternation(values) {
  return `(?:${sortForRegex(values).join("|")})`;
}

export function mixedAlternation(values) {
  const sortedValues = sortForRegex(values);
  const wordTokens = sortedValues.filter(isWordToken);
  const symbolTokens = sortedValues.filter(value => !isWordToken(value));
  const parts = [];

  if (wordTokens.length > 0) {
    parts.push(`\\b(?:${wordTokens.map(escapeRegex).join("|")})\\b`);
  }

  if (symbolTokens.length > 0) {
    parts.push(symbolTokens.map(escapeRegex).join("|"));
  }

  return parts.length === 1 ? parts[0] : `(?:${parts.join("|")})`;
}

export function sortForRegex(values) {
  return [...new Set(values)].sort((left, right) => right.length - left.length || left.localeCompare(right));
}

export function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}

export function buildSequencePattern(rule) {
  const unwrapped = unwrapRule(rule);
  if (unwrapped.type !== "SEQ") {
    throw new Error(`Expected rule to resolve to SEQ, received '${unwrapped.type}'.`);
  }

  return unwrapped.members.map(member => patternFragmentFor(member)).join("");
}

export function getRule(grammar, ruleName) {
  const rule = grammar?.rules?.[ruleName];
  if (!rule) {
    throw new Error(`Unable to find '${ruleName}' in tree-sitter/src/grammar.json`);
  }

  return rule;
}

function isWordToken(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
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
  return Array.from(
    text.matchAll(/'((?:\\.|[^'])*)'|"((?:\\.|[^"])*)"/g),
    match => match[1] || match[2]
  );
}

function pushUnique(map, key, value) {
  const existing = map.get(key) ?? [];
  if (!existing.includes(value)) {
    existing.push(value);
    map.set(key, existing);
  }
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
