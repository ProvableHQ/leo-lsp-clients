import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  compareVersions,
  parseStableVersion,
  shouldSyncTarget
} from "../scripts/lib/leo-release-version.mjs";

test("the release tag pattern accepts Leo language releases only", () => {
  const config = JSON.parse(fs.readFileSync(new URL("../.github/leo-tag-sync.json", import.meta.url), "utf8"));
  const pattern = new RegExp(config.stableTagPattern);

  assert.equal(pattern.test("leo-lang-v4.4.1"), true);
  assert.equal(pattern.test("leo-lsp-v4.4.1"), false);
});

test("namespaced versions use numeric ordering", () => {
  const newer = parseStableVersion("leo-lang-v4.10.0");
  const older = parseStableVersion("leo-lang-v4.9.9");

  assert.deepEqual(newer, [4, 10, 0]);
  assert.deepEqual(older, [4, 9, 9]);
  assert.ok(compareVersions(newer, older) > 0);
});

test("matching release provenance does not need a sync", () => {
  assert.equal(shouldSyncTarget({
    explicitRef: "",
    target: { name: "leo-lang-v4.4.1", commitSha: "b781b2d" },
    currentSourceRef: "leo-lang-v4.4.1",
    currentResolvedCommit: "b781b2d"
  }), false);
});
