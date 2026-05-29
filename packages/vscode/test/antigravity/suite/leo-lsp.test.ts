// packages/vscode/test/antigravity/suite/leo-lsp.test.ts
//
// In-process assertions that run inside the Antigravity extension host.
// runTest.ts sets LEO_FIXTURE_DIR and LEO_LSP_LOG_DIR via
// driveAlternateElectron's extensionTestsEnv. LEO_LSP_PATH is NOT propagated;
// the LSP-protocol-level smoke assertion runs as a pre-flight from
// runTest.ts, not from here.

import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

const LEO_LSP_LOG_DIR = process.env.LEO_LSP_LOG_DIR!;
const LEO_FIXTURE_DIR = process.env.LEO_FIXTURE_DIR!;

suite("Leo extension under Antigravity", () => {
  test("loads on .leo files (no-LSP fallback path)", async function () {
    this.timeout(30_000);
    const file = path.join(LEO_FIXTURE_DIR, "counter.leo");
    const doc = await vscode.workspace.openTextDocument(file);
    await vscode.window.showTextDocument(doc);
    assert.equal(doc.languageId, "leo", "language id must be 'leo'");
    fs.writeFileSync(
      path.join(LEO_LSP_LOG_DIR, "vscode-env.log"),
      `appName=${vscode.env.appName}\nappHost=${vscode.env.appHost}\n`
    );
  });

  test("definition of `increment` resolves via leo-lsp or fallback", async function () {
    this.timeout(60_000);
    const file = path.join(LEO_FIXTURE_DIR, "counter.leo");
    const doc = await vscode.workspace.openTextDocument(file);
    await vscode.window.showTextDocument(doc);

    // `increment` declaration in counter.leo: 0-indexed line 3, char 7 (the
    // `i`). Source of truth: packages/test-fixtures/README.md "Coordinate
    // table".
    const position = new vscode.Position(3, 7);
    const raw = await pollForDefinition(doc.uri, position, 30_000);

    assert.ok(
      Array.isArray(raw) && raw.length > 0,
      "expected at least one definition result for `increment`"
    );
    const first = raw[0] as vscode.Location & Partial<vscode.LocationLink>;
    const uri = first.targetUri ?? first.uri;
    const range = first.targetSelectionRange ?? first.targetRange ?? first.range;
    assert.ok(uri && range, "definition entry must carry uri+range");
    assert.match(uri.fsPath, /counter\.leo$/);
    assert.equal(
      range.start.line,
      3,
      "definition of `increment` must resolve to 0-indexed line 3"
    );
  });
});

async function pollForDefinition(
  uri: vscode.Uri,
  position: vscode.Position,
  timeoutMs: number
): Promise<vscode.Location[] | vscode.LocationLink[] | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = (await vscode.commands.executeCommand(
      "vscode.executeDefinitionProvider",
      uri,
      position
    )) as vscode.Location[] | vscode.LocationLink[] | undefined;
    if (Array.isArray(result) && result.length > 0) return result;
    await new Promise(r => setTimeout(r, 250));
  }
  return undefined;
}
