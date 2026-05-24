#!/usr/bin/env node
// @leo-lsp/discover — resolve an absolute leo-lsp path using the canonical
// 5-tier discovery order. Translation of packages/vscode/src/languageServer.ts:72-140.
//
// Usage:
//   leo-lsp-discover [--workspace <abs-path>]...
//
// Exit codes:
//   0  found; absolute path printed to stdout
//   1  not found; nothing printed

import { accessSync, constants, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, isAbsolute, join, resolve } from "node:path";

const SERVER_COMMAND = "leo-lsp";

const workspaces = [];
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--workspace") {
    const v = process.argv[i + 1];
    if (v && isAbsolute(v)) workspaces.push(v);
    i++;
  }
}

const executableName = process.platform === "win32" ? `${SERVER_COMMAND}.exe` : SERVER_COMMAND;
const candidates = [];

// Tier 2: $CARGO_HOME/bin (tier 1 — configured path — is supplied by the
// caller and is not the discover CLI's job; clients pass it directly to
// the server launcher and only fall through to this CLI on absence).
const cargoHome = process.env.CARGO_HOME?.trim();
if (cargoHome) candidates.push(join(cargoHome, "bin", executableName));

// Tier 3: ~/.cargo/bin.
candidates.push(join(homedir(), ".cargo", "bin", executableName));

// Tier 4: every directory on $PATH, in order.
for (const entry of (process.env.PATH ?? "").split(delimiter)) {
  if (entry.length === 0) continue;
  candidates.push(join(entry, executableName));
}

// Tier 5: <workspace>/target/{debug,release}/leo-lsp for each provided workspace.
for (const ws of workspaces) {
  candidates.push(join(ws, "target", "debug", executableName));
  candidates.push(join(ws, "target", "release", executableName));
}

const seen = new Set();
for (const candidate of candidates) {
  const abs = resolve(candidate);
  if (seen.has(abs)) continue;
  seen.add(abs);
  if (isExecutableFile(abs)) {
    process.stdout.write(`${abs}\n`);
    process.exit(0);
  }
}

process.exit(1);

function isExecutableFile(candidate) {
  const mode = process.platform === "win32" ? constants.F_OK : constants.X_OK;
  try {
    if (!statSync(candidate).isFile()) return false;
    accessSync(candidate, mode);
    return true;
  } catch {
    return false;
  }
}
