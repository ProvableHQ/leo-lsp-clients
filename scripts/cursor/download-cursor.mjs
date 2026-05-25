// scripts/cursor/download-cursor.mjs
//
// Resolve a Cursor binary on the host machine. Cursor is not redistributable,
// so we do not download it ourselves; we resolve it from a local install or a
// CURSOR_CLI / CURSOR_APP env var, failing fast if not present.
//
// Returns an object { cli, app } via JSON on stdout when invoked directly, or
// programmatically via the exported `resolveCursor` function.

import { existsSync } from "node:fs";
import { platform } from "node:os";

const MAC_DEFAULT_CLI = "/Applications/Cursor.app/Contents/Resources/app/bin/cursor";
const MAC_DEFAULT_APP = "/Applications/Cursor.app";

export function resolveCursor() {
  const cli = process.env.CURSOR_CLI?.trim();
  const app = process.env.CURSOR_APP?.trim();

  if (cli && existsSync(cli)) {
    return { cli, app: app || deriveAppFromCli(cli) };
  }

  if (platform() === "darwin") {
    if (existsSync(MAC_DEFAULT_CLI) && existsSync(MAC_DEFAULT_APP)) {
      return { cli: MAC_DEFAULT_CLI, app: MAC_DEFAULT_APP };
    }
  }

  console.error(
    "Cursor binary not found.\n" +
    "Install Cursor from https://cursor.com/, or export CURSOR_CLI to the\n" +
    "absolute path of the `cursor` shell command (typically\n" +
    "/Applications/Cursor.app/Contents/Resources/app/bin/cursor on macOS)."
  );
  process.exit(1);
}

function deriveAppFromCli(cli) {
  const idx = cli.indexOf(".app/");
  return idx >= 0 ? cli.slice(0, idx + ".app".length) : cli;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { cli, app } = resolveCursor();
  console.log(JSON.stringify({ cli, app }));
}
