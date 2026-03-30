import * as vscode from "vscode";

type DefinitionPattern = {
  kind: string;
  regex: RegExp;
};

const SEARCH_INCLUDE = "**/*.leo";
const SEARCH_EXCLUDE = "**/{.git,node_modules,target,dist,out}/**";
const MAX_RESULTS = 32;

const SAME_FILE_PATTERNS: readonly DefinitionPattern[] = [
  { kind: "function", regex: /^\s*(?:final\s+fn|fn)\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm },
  { kind: "type", regex: /^\s*(?:struct|record|interface|mapping|storage)\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm },
  { kind: "constant", regex: /^\s*const\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm },
  { kind: "program", regex: /^\s*program\s+([A-Za-z_][A-Za-z0-9_]*)\.aleo\b/gm },
  { kind: "let", regex: /\blet\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm },
  { kind: "loop", regex: /\bfor\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\b/gm }
];

const WORKSPACE_PATTERNS: readonly DefinitionPattern[] = [
  { kind: "function", regex: /^\s*(?:final\s+fn|fn)\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm },
  { kind: "type", regex: /^\s*(?:struct|record|interface|mapping|storage)\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm },
  { kind: "constant", regex: /^\s*const\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm },
  { kind: "program", regex: /^\s*program\s+([A-Za-z_][A-Za-z0-9_]*)\.aleo\b/gm }
];

type FoundDefinition = {
  kind: string;
  location: vscode.Location;
};

export function createLeoDefinitionProvider(): vscode.DefinitionProvider {
  return {
    async provideDefinition(document, position) {
      const symbol = getSymbolAtPosition(document, position);
      if (!symbol) {
        return undefined;
      }

      const sameFile = findDefinitions(document, symbol, SAME_FILE_PATTERNS)
        .filter(({ location }) => !location.range.contains(position));
      if (sameFile.length > 0) {
        return uniqueLocations(sameFile);
      }

      const uris = await vscode.workspace.findFiles(SEARCH_INCLUDE, SEARCH_EXCLUDE, MAX_RESULTS);
      const workspaceResults: FoundDefinition[] = [];

      for (const uri of uris) {
        if (uri.toString() === document.uri.toString()) {
          continue;
        }

        const candidate = await vscode.workspace.openTextDocument(uri);
        workspaceResults.push(...findDefinitions(candidate, symbol, WORKSPACE_PATTERNS));

        if (workspaceResults.length >= MAX_RESULTS) {
          break;
        }
      }

      if (workspaceResults.length === 0) {
        return undefined;
      }

      return uniqueLocations(workspaceResults);
    }
  };
}

function getSymbolAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
  const range = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
  return range ? document.getText(range) : undefined;
}

function findDefinitions(
  document: vscode.TextDocument,
  symbol: string,
  patterns: readonly DefinitionPattern[]
): FoundDefinition[] {
  const text = document.getText();
  const results: FoundDefinition[] = [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const candidate = match[1];
      if (candidate !== symbol) {
        continue;
      }

      const captureOffset = match[0].indexOf(candidate);
      const startOffset = match.index + captureOffset;
      const start = document.positionAt(startOffset);
      const end = document.positionAt(startOffset + candidate.length);
      results.push({
        kind: pattern.kind,
        location: new vscode.Location(document.uri, new vscode.Range(start, end))
      });
    }
  }

  return results;
}

function uniqueLocations(definitions: readonly FoundDefinition[]): vscode.Location[] {
  const seen = new Set<string>();
  const ordered = definitions
    .slice()
    .sort((left, right) => left.kind.localeCompare(right.kind));
  const locations: vscode.Location[] = [];

  for (const definition of ordered) {
    const { uri, range } = definition.location;
    const key = `${uri.toString()}:${range.start.line}:${range.start.character}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    locations.push(definition.location);
  }

  return locations;
}

