// scripts/cursor/teardown.mjs
//
// Remove the isolated user-data and extensions directories the Cursor
// validation harness creates under $TMPDIR/leo-cursor-it.

import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = join(tmpdir(), "leo-cursor-it");
rmSync(target, { recursive: true, force: true });
console.log(`Removed ${target}`);
