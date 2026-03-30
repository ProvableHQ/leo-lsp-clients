import {
  escapeRegex,
  mixedAlternation,
  plainAlternation,
  rawAlternation,
  wordAlternation
} from "./leo-syntax-data.mjs";

export function buildTextMateGrammar(syntaxData) {
  return {
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
            match: syntaxData.lineCommentPattern
          },
          {
            name: "comment.block.leo",
            match: syntaxData.blockCommentPattern
          }
        ]
      },
      annotations: {
        patterns: [
          {
            name: "entity.other.attribute-name.leo",
            match: `@(?:${syntaxData.identifierPattern})`
          }
        ]
      },
      strings: {
        patterns: [
          {
            name: "string.quoted.double.leo",
            match: syntaxData.stringPattern
          }
        ]
      },
      numbers: {
        patterns: syntaxData.numberPatterns.length === 0
          ? []
          : [
              {
                name: "constant.numeric.leo",
                match: rawAlternation(syntaxData.numberPatterns)
              }
            ]
      },
      addresses: {
        patterns: [
          {
            name: "string.special.address.leo",
            match: syntaxData.addressPattern
          }
        ]
      },
      programDeclarations: {
        patterns: buildDeclarationPatterns(
          syntaxData.nameCaptureParents.get("namespace") ?? [],
          syntaxData.identifierPattern
        )
      },
      typeDeclarations: {
        patterns: buildDeclarationPatterns(
          syntaxData.nameCaptureParents.get("type") ?? [],
          syntaxData.identifierPattern
        )
      },
      functionDeclarations: {
        patterns: [
          ...buildDeclarationPatterns(
            syntaxData.nameCaptureParents.get("function") ?? [],
            syntaxData.identifierPattern
          ),
          ...((syntaxData.captureStrings.get("function") ?? []).includes("constructor")
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
        patterns: syntaxData.keywordTokens.length === 0
          ? []
          : [
              {
                name: "keyword.control.leo",
                match: wordAlternation(syntaxData.keywordTokens)
              }
            ]
      },
      types: {
        patterns: syntaxData.primitiveTypes.length === 0
          ? []
          : [
              {
                name: "storage.type.primitive.leo",
                match: wordAlternation(syntaxData.primitiveTypes)
              }
            ]
      },
      constants: {
        patterns: [
          ...(syntaxData.builtinConstantTokens.length === 0
            ? []
            : [
                {
                  name: "constant.language.leo",
                  match: wordAlternation(syntaxData.builtinConstantTokens)
                }
              ]),
          ...(syntaxData.specialPathPatterns.length === 0
            ? []
            : [
                {
                  name: "constant.language.special-path.leo",
                  match: rawAlternation(syntaxData.specialPathPatterns)
                }
              ])
        ]
      },
      operators: {
        patterns: syntaxData.operatorTokens.length === 0
          ? []
          : [
              {
                name: "keyword.operator.leo",
                match: mixedAlternation(syntaxData.operatorTokens)
              }
            ]
      },
      punctuation: {
        patterns: buildPunctuationPatterns(syntaxData)
      }
    }
  };
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

function buildPunctuationPatterns(syntaxData) {
  const patterns = [];

  if (syntaxData.punctuationBracketTokens.length > 0) {
    patterns.push({
      name: "punctuation.bracket.leo",
      match: plainAlternation(syntaxData.punctuationBracketTokens)
    });
  }

  if (syntaxData.punctuationDelimiterTokens.length > 0) {
    patterns.push({
      name: "punctuation.delimiter.leo",
      match: plainAlternation(syntaxData.punctuationDelimiterTokens)
    });
  }

  return patterns;
}
