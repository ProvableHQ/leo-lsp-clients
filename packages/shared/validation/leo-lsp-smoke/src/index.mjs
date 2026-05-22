#!/usr/bin/env node
// @leo-lsp/smoke — LSP-level smoke driver for `leo-lsp`.
//
// Usage:
//   leo-lsp-smoke \
//     --server <abs-path-to-leo-lsp> \
//     --file   <abs-path-to.leo> \
//     --line   <1-indexed-line> \
//     --char   <1-indexed-column> \
//     [--expect-file <abs-path>] \
//     [--expect-line <1-indexed-line>] \
//     [--timeout <ms>]
//
// Exit codes:
//   0  PASS
//   1  invalid arguments
//   2  server failed to start (spawn error, immediate exit, or initialize timeout)
//   3  LSP protocol error (initialize response missing capabilities, malformed response, etc.)
//   4  assertion failed (no Location[] returned, or --expect-* mismatch)
//
// Always writes a transcript to $LEO_LSP_SMOKE_LOG if that env var is set.

import { spawn } from "node:child_process";
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter
} from "vscode-jsonrpc/node.js";

const args = parseArgs(process.argv.slice(2));
const logPath = process.env.LEO_LSP_SMOKE_LOG?.trim() || "";
if (logPath) {
  mkdirSync(dirname(logPath), { recursive: true });
}

function tee(label, payload) {
  if (!logPath) return;
  appendFileSync(logPath, `${new Date().toISOString()} ${label} ${JSON.stringify(payload)}\n`);
}

function pass(symbol, targetUri, targetLine) {
  process.stdout.write(
    `PASS: leo-lsp resolved ${symbol} at ${args.file}:${args.line}:${args.char} -> ${targetUri}:${targetLine + 1}\n`
  );
  process.exit(0);
}

function fail(code, reason) {
  process.stderr.write(`FAIL: ${reason}\n`);
  tee("fail", { code, reason });
  process.exit(code);
}

const fileContents = (() => {
  try {
    return readFileSync(args.file, "utf8");
  } catch (err) {
    fail(1, `cannot read --file ${args.file}: ${err.message}`);
  }
})();

const child = spawn(args.server, [], { stdio: ["pipe", "pipe", "pipe"] });
let serverExitedEarly = false;
child.on("error", err => fail(2, `failed to spawn ${args.server}: ${err.message}`));
child.on("exit", code => {
  if (!serverExitedEarly && code !== 0) {
    fail(2, `leo-lsp exited with code ${code} before shutdown`);
  }
});
child.stderr.on("data", chunk => tee("stderr", chunk.toString()));

const connection = createMessageConnection(
  new StreamMessageReader(child.stdout),
  new StreamMessageWriter(child.stdin)
);
connection.listen();

const timeout = setTimeout(() => fail(2, `timed out after ${args.timeout}ms`), args.timeout);

try {
  const rootUri = pathToFileURL(dirname(args.file)).toString();
  const fileUri = pathToFileURL(args.file).toString();

  tee("send", { method: "initialize", rootUri });
  const initResult = await connection.sendRequest("initialize", {
    processId: process.pid,
    rootUri,
    capabilities: { textDocument: { definition: {} } }
  });
  tee("recv", { method: "initialize", result: initResult });
  if (!initResult || typeof initResult !== "object") {
    fail(3, "initialize response was not an object");
  }

  connection.sendNotification("initialized", {});
  connection.sendNotification("textDocument/didOpen", {
    textDocument: { uri: fileUri, languageId: "leo", version: 1, text: fileContents }
  });
  tee("send", { method: "textDocument/didOpen", uri: fileUri });

  const position = { line: args.line - 1, character: args.char - 1 };
  tee("send", { method: "textDocument/definition", position });
  const defResult = await connection.sendRequest("textDocument/definition", {
    textDocument: { uri: fileUri },
    position
  });
  tee("recv", { method: "textDocument/definition", result: defResult });

  const locations = normalizeLocations(defResult);
  if (locations.length === 0) {
    fail(4, `expected non-empty Location[] for cursor ${args.file}:${args.line}:${args.char}`);
  }

  const first = locations[0];
  if (args.expectFile) {
    const expectedUri = pathToFileURL(args.expectFile).toString();
    if (first.uri !== expectedUri) {
      fail(4, `expected target uri ${expectedUri}, got ${first.uri}`);
    }
  }
  if (args.expectLine !== undefined && first.range.start.line !== args.expectLine - 1) {
    fail(4, `expected target line ${args.expectLine} (0-indexed ${args.expectLine - 1}), got 0-indexed ${first.range.start.line}`);
  }

  serverExitedEarly = true;
  await connection.sendRequest("shutdown", null);
  connection.sendNotification("exit");
  clearTimeout(timeout);
  pass(`${args.file}:${args.line}:${args.char}`, first.uri, first.range.start.line);
} catch (err) {
  fail(3, err instanceof Error ? err.message : String(err));
}

function normalizeLocations(result) {
  if (result === null || result === undefined) return [];
  if (Array.isArray(result)) {
    return result.map(item =>
      "targetUri" in item
        ? { uri: item.targetUri, range: item.targetSelectionRange ?? item.targetRange }
        : item
    );
  }
  return [result];
}

function parseArgs(argv) {
  const out = { timeout: 10000 };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case "--server":      out.server = value; i++; break;
      case "--file":        out.file = value; i++; break;
      case "--line":        out.line = Number.parseInt(value, 10); i++; break;
      case "--char":        out.char = Number.parseInt(value, 10); i++; break;
      case "--expect-file": out.expectFile = value; i++; break;
      case "--expect-line": out.expectLine = Number.parseInt(value, 10); i++; break;
      case "--timeout":     out.timeout = Number.parseInt(value, 10); i++; break;
      default:
        process.stderr.write(`FAIL: unknown argument ${flag}\n`);
        process.exit(1);
    }
  }
  for (const required of ["server", "file", "line", "char"]) {
    if (out[required] === undefined || (typeof out[required] === "number" && Number.isNaN(out[required]))) {
      process.stderr.write(`FAIL: missing required --${required}\n`);
      process.exit(1);
    }
  }
  if (!isAbsolute(out.server) || !isAbsolute(out.file)) {
    process.stderr.write("FAIL: --server and --file must be absolute paths\n");
    process.exit(1);
  }
  return out;
}
