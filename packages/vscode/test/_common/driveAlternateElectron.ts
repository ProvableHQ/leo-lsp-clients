// packages/vscode/test/_common/driveAlternateElectron.ts
//
// Shared harness for driving a VS Code-derivative Electron binary (Cursor,
// Antigravity, code-OSS, etc.) under `@vscode/test-electron`. Factored out
// of the PR 1 (Cursor) and PR 2 (Antigravity) specs which each planned to
// vendor a near-identical copy.
//
// The caller supplies a HostBinary descriptor plus the per-test config and
// receives a pass/fail summary. The harness handles:
//   - Isolated --user-data-dir and --extensions-dir under $TMPDIR/<slug>-it.
//   - VSIX install via the host's own CLI (cursor --install-extension,
//     antigravity --install-extension, ...).
//   - Mocha launch via runTests() with --extensionDevelopmentPath.
//   - Per-run log directory ($TMPDIR/<slug>-it/logs).
//   - LEO_REQUIRE_LSP enforcement: when set, the harness greps for the
//     "Starting leo-lsp from" line in the captured Leo Language Server
//     output channel logs, and fails the run if it does not appear.
//
// Usage from a client harness:
//
//   import { driveAlternateElectron } from "../_common/driveAlternateElectron";
//   await driveAlternateElectron({
//     slug: "cursor",
//     host: { cli: "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
//             electron: "/Applications/Cursor.app/Contents/MacOS/Cursor",
//             channelLogGlob: "**/*Leo Language Server*.log" },
//     vsixPath, extensionDir, suiteIndex, fixtureDir,
//     requireLsp: process.env.LEO_REQUIRE_LSP === "1"
//   });

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

export interface HostBinary {
  /** Path to the host CLI shim (used for --install-extension). */
  cli: string;
  /** Path to the host Electron binary (used as vscodeExecutablePath). */
  electron: string;
  /** Glob (relative to the per-run log dir) that should match the Leo
   *  Language Server output channel log file. Used by --require-lsp. */
  channelLogGlob: string;
}

export interface DriveOptions {
  /** Slug used for the isolated state directory: $TMPDIR/<slug>-it. */
  slug: string;
  host: HostBinary;
  /** Absolute path to the prebuilt .vsix. */
  vsixPath: string;
  /** Absolute path to the extension dev root (the package containing
   *  package.json with `main`). */
  extensionDir: string;
  /** Absolute path to the Mocha suite index .js (already-built). */
  suiteIndex: string;
  /** Absolute path to the fixture directory to open as workspace. */
  fixtureDir: string;
  /** When true, fail if no "Starting leo-lsp from" line is captured. */
  requireLsp: boolean;
  /** Optional extra args for the host launch. */
  extraLaunchArgs?: string[];
}

export interface DriveResult {
  pass: boolean;
  reason?: string;
  logDir: string;
}

export async function driveAlternateElectron(opts: DriveOptions): Promise<DriveResult> {
  if (!fs.existsSync(opts.vsixPath)) {
    return fail(opts, `VSIX not found at ${opts.vsixPath}`);
  }
  if (!fs.existsSync(opts.host.cli) || !fs.existsSync(opts.host.electron)) {
    return fail(
      opts,
      `host binaries missing: cli=${opts.host.cli} electron=${opts.host.electron}`
    );
  }

  const isolatedRoot = path.join(os.tmpdir(), `${opts.slug}-it`);
  const userDataDir = path.join(isolatedRoot, "user-data");
  const extensionsDir = path.join(isolatedRoot, "extensions");
  const logDir = path.join(isolatedRoot, "logs");
  fs.rmSync(isolatedRoot, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(extensionsDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  // 1. Install the VSIX into the isolated profile via the host CLI.
  const installResult = spawnSync(
    opts.host.cli,
    [
      "--install-extension", opts.vsixPath,
      "--extensions-dir", extensionsDir,
      "--user-data-dir", userDataDir,
      "--force"
    ],
    { encoding: "utf-8" }
  );
  fs.writeFileSync(
    path.join(logDir, "install.log"),
    `${installResult.stdout ?? ""}\n--- stderr ---\n${installResult.stderr ?? ""}\n`
  );
  if (installResult.status !== 0) {
    return fail(opts, `install exited ${installResult.status}; see ${logDir}/install.log`, logDir);
  }

  // 2. Launch the host Electron binary under @vscode/test-electron.
  try {
    await runTests({
      vscodeExecutablePath: opts.host.electron,
      extensionDevelopmentPath: opts.extensionDir,
      extensionTestsPath: opts.suiteIndex,
      launchArgs: [
        opts.fixtureDir,
        "--user-data-dir", userDataDir,
        "--extensions-dir", extensionsDir,
        "--logsPath", path.join(logDir, "host-logs"),
        "--disable-gpu",
        "--disable-workspace-trust",
        "--no-sandbox",
        ...(opts.extraLaunchArgs ?? [])
      ],
      extensionTestsEnv: {
        LEO_LSP_LOG_DIR: logDir,
        LEO_FIXTURE_DIR: opts.fixtureDir
      }
    });
  } catch (err) {
    return fail(opts, `runTests failed: ${describe(err)}`, logDir);
  }

  if (opts.requireLsp) {
    const matched = await findChannelLogStartupLine(logDir, opts.host.channelLogGlob);
    if (!matched) {
      return fail(opts, "LEO_REQUIRE_LSP=1 but no 'Starting leo-lsp from' line in channel logs", logDir);
    }
  }

  return { pass: true, logDir };
}

async function findChannelLogStartupLine(logDir: string, channelLogGlob: string): Promise<boolean> {
  // Tiny glob walker — avoid pulling in `glob` as a dep at this layer.
  const matches: string[] = [];
  walk(logDir, p => {
    if (matchesGlob(path.relative(logDir, p), channelLogGlob)) matches.push(p);
  });
  for (const p of matches) {
    const contents = fs.readFileSync(p, "utf8");
    if (contents.includes("Starting leo-lsp from")) return true;
  }
  return false;
}

function walk(dir: string, visit: (p: string) => void): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else if (entry.isFile()) visit(full);
  }
}

function matchesGlob(relpath: string, pattern: string): boolean {
  // Translate the tiny subset of glob we actually use (`**`, `*`) to RegExp.
  const re = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DOUBLESTAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLESTAR::/g, ".*");
  return new RegExp(`^${re}$`).test(relpath);
}

function describe(err: unknown): string {
  if (err instanceof Error) return `${err.message}\n${err.stack ?? ""}`;
  return String(err);
}

function fail(opts: DriveOptions, reason: string, logDir?: string): DriveResult {
  const dir = logDir ?? path.join(os.tmpdir(), `${opts.slug}-it`, "logs");
  process.stderr.write(`FAIL: ${reason}\n`);
  return { pass: false, reason, logDir: dir };
}
