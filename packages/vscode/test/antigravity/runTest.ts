// packages/vscode/test/antigravity/runTest.ts
//
// Headless self-validation of the Leo extension under Google Antigravity.
// Mirrors packages/vscode/test/cursor/runCursorTests.ts; the two harnesses
// differ only in the HostBinary descriptor handed to the shared
// driveAlternateElectron helper from PR 0.
//
// The harness:
//   1. Resolves an Antigravity binary on the host machine.
//   2. Optionally runs the leo-lsp-smoke pre-flight when a leo-lsp is on disk,
//      so an LSP-server regression is reported before Antigravity is launched.
//   3. Hands the binary descriptor to driveAlternateElectron, which installs
//      the freshly-built VSIX into an isolated profile and launches
//      Antigravity headless with the Mocha suite at suite/index.js.
//   4. Returns the helper's exit code.

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { driveAlternateElectron } from "../_common/driveAlternateElectron";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const EXTENSION_DIR = path.resolve(__dirname, "..", "..", "..");
const VSIX_PATH = path.join(REPO_ROOT, "dist", "leo-extension.vsix");
const FIXTURE_DIR = path.join(REPO_ROOT, "packages", "test-fixtures", "samples");
const SUITE_INDEX = path.resolve(__dirname, "suite", "index.js");

function resolveAntigravity(): { cli: string; electron: string } {
  // Antigravity ships as TWO bundles: /Applications/Antigravity.app is the Hub
  // launcher (no VS Code engine, can't load extensions); /Applications/Antigravity IDE.app
  // is the actual VS Code-style IDE that loads our VSIX. Always target the IDE
  // bundle, never the Hub.
  const envCli = process.env.ANTIGRAVITY_CLI?.trim();
  if (envCli && fs.existsSync(envCli)) {
    return { cli: envCli, electron: deriveElectronFromCli(envCli) };
  }
  if (process.platform === "darwin") {
    const cli = "/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide";
    const electron = "/Applications/Antigravity IDE.app/Contents/MacOS/Electron";
    if (fs.existsSync(cli) && fs.existsSync(electron)) return { cli, electron };
  }
  console.error(
    "Antigravity IDE binary not found.\n" +
      "Install Antigravity from https://antigravity.google/ and complete the IDE\n" +
      "install wizard (the Hub at /Applications/Antigravity.app is not enough on its\n" +
      "own — the wizard installs /Applications/Antigravity IDE.app separately).\n" +
      "Alternatively export ANTIGRAVITY_CLI to the absolute path of the\n" +
      "`antigravity-ide` shell command (typically\n" +
      "/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide on macOS)."
  );
  process.exit(1);
}

function deriveElectronFromCli(cli: string): string {
  // .../Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide
  //   → .../Antigravity IDE.app/Contents/MacOS/Electron
  const idx = cli.indexOf(".app/");
  if (idx < 0) return cli;
  const appRoot = cli.slice(0, idx + ".app".length);
  return path.join(appRoot, "Contents", "MacOS", "Electron");
}

// Resolve a leo-lsp binary by explicit LEO_LSP_PATH, then by PATH lookup.
// Returns null when neither resolves; LEO_REQUIRE_LSP enforces the must-have
// case from main().
function resolveLeoLsp(): string | null {
  const explicit = process.env.LEO_LSP_PATH?.trim();
  if (explicit && fs.existsSync(explicit)) return explicit;
  const which = spawnSync("/usr/bin/env", ["sh", "-c", "command -v leo-lsp"], {
    encoding: "utf-8"
  });
  const hit = (which.stdout ?? "").trim();
  return hit && fs.existsSync(hit) ? hit : null;
}

// LSP-protocol-level pre-flight. Invokes the smoke CLI by absolute path to
// avoid npm-workspace resolution variability.
function runLspSmokePreflight(server: string, fixture: string): boolean {
  // Coordinates per packages/test-fixtures/README.md "Coordinate table"
  // (1-indexed): `increment` at counter.leo line 4, char 8.
  const smokeBin = path.join(
    REPO_ROOT,
    "packages",
    "shared",
    "validation",
    "leo-lsp-smoke",
    "src",
    "index.mjs"
  );
  const result = spawnSync(
    process.execPath,
    [smokeBin, "--server", server, "--file", fixture, "--line", "4", "--char", "8"],
    { encoding: "utf-8" }
  );
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) {
    process.stderr.write(`leo-lsp-smoke spawn error: ${result.error.message}\n`);
    return false;
  }
  return result.status === 0;
}

async function main(): Promise<void> {
  const { cli, electron } = resolveAntigravity();
  const requireLsp = process.env.LEO_REQUIRE_LSP === "1";
  const leoLsp = resolveLeoLsp();

  if (requireLsp && !leoLsp) {
    console.error("LEO_REQUIRE_LSP=1 but no leo-lsp found on PATH or in LEO_LSP_PATH.");
    process.exit(1);
  }
  if (leoLsp) {
    const fixture = path.join(FIXTURE_DIR, "counter.leo");
    if (!runLspSmokePreflight(leoLsp, fixture)) {
      console.error("FAIL: leo-lsp-smoke pre-flight failed before launching Antigravity.");
      process.exit(1);
    }
  }

  const result = await driveAlternateElectron({
    slug: "antigravity",
    host: { cli, electron, channelLogGlob: "**/*Leo Language Server*.log" },
    vsixPath: VSIX_PATH,
    extensionDir: EXTENSION_DIR,
    suiteIndex: SUITE_INDEX,
    fixtureDir: FIXTURE_DIR,
    requireLsp
  });
  if (!result.pass) {
    console.error(`FAIL: ${result.reason}; see ${result.logDir}`);
    process.exit(1);
  }
  console.log(
    `PASS: Leo extension drove a real LSP request in Antigravity (logs in ${result.logDir})`
  );
  process.exit(0);
}

void main();
