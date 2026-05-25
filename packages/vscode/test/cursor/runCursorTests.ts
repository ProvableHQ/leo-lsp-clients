// packages/vscode/test/cursor/runCursorTests.ts
//
// Self-validation harness for the Leo extension running inside Cursor.
// Thin wrapper around the shared custom-Electron driver provided by PR 0
// (packages/vscode/test/_common/driveAlternateElectron.ts).
//
// The harness:
//   1. Resolves a Cursor binary on the host machine.
//   2. Hands it to driveAlternateElectron, which installs the freshly-built
//      VSIX into an isolated profile and launches Cursor headless with the
//      Mocha suite at suite/index.js.
//   3. Returns the helper's exit code.

import * as fs from "node:fs";
import * as path from "node:path";
import { driveAlternateElectron } from "../_common/driveAlternateElectron";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const EXTENSION_DIR = path.resolve(__dirname, "..", "..", "..");
const VSIX_PATH = path.join(REPO_ROOT, "dist", "leo-extension.vsix");
const FIXTURE_DIR = path.join(REPO_ROOT, "packages", "test-fixtures", "samples");
const SUITE_INDEX = path.resolve(__dirname, "suite", "index.js");

function resolveCursor(): { cli: string; electron: string } {
  const envCli = process.env.CURSOR_CLI?.trim();
  if (envCli && fs.existsSync(envCli)) {
    return { cli: envCli, electron: deriveElectronFromCli(envCli) };
  }
  if (process.platform === "darwin") {
    const cli = "/Applications/Cursor.app/Contents/Resources/app/bin/cursor";
    const electron = "/Applications/Cursor.app/Contents/MacOS/Cursor";
    if (fs.existsSync(cli) && fs.existsSync(electron)) return { cli, electron };
  }
  console.error(
    "Cursor binary not found.\n" +
      "Install Cursor from https://cursor.com/, or export CURSOR_CLI\n" +
      "to the absolute path of the `cursor` shell command (typically\n" +
      "/Applications/Cursor.app/Contents/Resources/app/bin/cursor on macOS)."
  );
  process.exit(1);
}

function deriveElectronFromCli(cli: string): string {
  // .../Cursor.app/Contents/Resources/app/bin/cursor
  //   → .../Cursor.app/Contents/MacOS/Cursor
  const idx = cli.indexOf(".app/");
  if (idx < 0) return cli;
  const appRoot = cli.slice(0, idx + ".app".length);
  return path.join(appRoot, "Contents", "MacOS", "Cursor");
}

async function main(): Promise<void> {
  const { cli, electron } = resolveCursor();
  const result = await driveAlternateElectron({
    slug: "leo-cursor",
    host: { cli, electron, channelLogGlob: "**/*Leo Language Server*.log" },
    vsixPath: VSIX_PATH,
    extensionDir: EXTENSION_DIR,
    suiteIndex: SUITE_INDEX,
    fixtureDir: FIXTURE_DIR,
    requireLsp: process.env.LEO_REQUIRE_LSP === "1"
  });
  if (!result.pass) {
    console.error(`FAIL: ${result.reason}; see ${result.logDir}`);
    process.exit(1);
  }
  console.log(
    `PASS: Leo extension drove a real LSP request in Cursor (logs in ${result.logDir})`
  );
  process.exit(0);
}

void main();
