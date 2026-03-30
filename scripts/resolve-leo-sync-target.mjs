#!/usr/bin/env node

// Chooses which Leo ref the automation should sync next.
// - Reads `.github/leo-tag-sync.json` for the source repo, stable tag pattern,
//   automation branch, and PR title prefix.
// - Compares the newest matching Leo tag, or an explicitly provided `--leo-ref`,
//   against `packages/vscode/generated-from-leo.json`.
// - Emits workflow-friendly outputs so GitHub Actions can decide whether to
//   open or update the release-sync PR.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const configPath = resolveArg(
  readOption("--config"),
  path.join(repoRoot, ".github/leo-tag-sync.json")
);
const metadataPath = resolveArg(
  readOption("--metadata"),
  path.join(repoRoot, "packages/vscode/generated-from-leo.json")
);
const explicitRef = (readOption("--leo-ref") ?? "").trim();
const githubOutputPath = readOption("--github-output");

const config = readRequiredJson(configPath);
const metadata = readOptionalJson(metadataPath);

const sourceRepo = validateString(config.sourceRepo, "sourceRepo");
const stableTagPattern = validateString(config.stableTagPattern, "stableTagPattern");
const syncBranch = validateString(config.syncBranch, "syncBranch");
const pullRequestTitlePrefix = validateString(
  config.pullRequestTitlePrefix,
  "pullRequestTitlePrefix"
);

const target = explicitRef
  ? {
      name: explicitRef,
      commitSha: ""
    }
  : await findLatestStableTag({
      sourceRepo,
      stableTagPattern,
      token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || ""
    });

const currentSourceRef = typeof metadata.sourceRef === "string" ? metadata.sourceRef : "";
const currentResolvedCommit =
  typeof metadata.resolvedCommit === "string" ? metadata.resolvedCommit : "";

const shouldSync = explicitRef
  ? currentSourceRef !== target.name
  : currentSourceRef !== target.name &&
    (!target.commitSha || currentResolvedCommit !== target.commitSha);

const result = {
  should_sync: shouldSync ? "true" : "false",
  source_repo: sourceRepo,
  target_ref: target.name,
  target_commit: target.commitSha,
  sync_branch: syncBranch,
  pr_title: `${pullRequestTitlePrefix}${target.name}`
};

if (githubOutputPath) {
  writeGitHubOutputs(githubOutputPath, result);
}

process.stdout.write(
  `${JSON.stringify(
    {
      shouldSync,
      sourceRepo,
      targetRef: target.name,
      targetCommit: target.commitSha,
      syncBranch,
      prTitle: result.pr_title
    },
    null,
    2
  )}\n`
);

function resolveArg(value, fallback) {
  return value ? path.resolve(process.cwd(), value) : fallback;
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function readRequiredJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validateString(value, fieldName) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Expected '${fieldName}' to be a non-empty string.`);
  }

  return value;
}

async function findLatestStableTag({ sourceRepo, stableTagPattern, token }) {
  const tagMatcher = new RegExp(stableTagPattern);
  const tags = [];

  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${sourceRepo}/tags?per_page=100&page=${page}`,
      {
        headers: buildHeaders(token)
      }
    );

    if (!response.ok) {
      throw new Error(
        `Unable to list tags for ${sourceRepo}: ${response.status} ${response.statusText}`
      );
    }

    const pageTags = await response.json();
    if (!Array.isArray(pageTags) || pageTags.length === 0) {
      break;
    }

    tags.push(...pageTags);

    if (pageTags.length < 100) {
      break;
    }
  }

  const stableTags = tags
    .filter(tag => typeof tag?.name === "string" && tagMatcher.test(tag.name))
    .map(tag => ({
      name: tag.name,
      commitSha: typeof tag?.commit?.sha === "string" ? tag.commit.sha : "",
      version: parseStableVersion(tag.name)
    }))
    .filter(tag => tag.version !== null)
    .sort((left, right) => compareVersions(right.version, left.version));

  if (stableTags.length === 0) {
    throw new Error(`No stable Leo release tags matched '${stableTagPattern}'.`);
  }

  return stableTags[0];
}

function buildHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "leo-lsp-clients-tag-sync"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function parseStableVersion(tagName) {
  const cleaned = tagName.startsWith("v") ? tagName.slice(1) : tagName;
  const parts = cleaned.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const numbers = parts.map(part => Number.parseInt(part, 10));
  if (numbers.some(number => Number.isNaN(number))) {
    return null;
  }

  return numbers;
}

function compareVersions(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

function writeGitHubOutputs(filePath, values) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(filePath, `${lines.join("\n")}\n`);
}
