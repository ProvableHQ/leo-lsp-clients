// packages/vscode/test/cursor/suite/index.ts
//
// Mocha runner glue, vendored from the canonical recipe at the bottom of
// `@vscode/test-electron`'s npm page.

import * as path from "node:path";
import { promises as fsp } from "node:fs";
import Mocha from "mocha";

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", color: true, timeout: 60_000 });
  const testsRoot = path.resolve(__dirname);

  const files = await collectTestFiles(testsRoot);
  for (const f of files) mocha.addFile(f);

  await new Promise<void>((resolve, reject) => {
    mocha.run(failures =>
      failures ? reject(new Error(`${failures} tests failed`)) : resolve()
    );
  });
}

async function collectTestFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith(".test.js")) out.push(full);
    }
  }
  await walk(root);
  return out;
}
