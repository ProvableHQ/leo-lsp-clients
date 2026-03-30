import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function readOption(name, argv = process.argv) {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return argv[index + 1];
}

export function resolveArg(value, fallback) {
  return value ? path.resolve(process.cwd(), value) : fallback;
}

export function loadLeoTreeSitterSource({
  repoRoot,
  argv = process.argv,
  defaultLeoRepo,
  defaultLeoRef = "HEAD",
  sourceRepo = "ProvableHQ/leo"
}) {
  const grammarFile = readOption("--grammar-file", argv);
  const highlightsFile = readOption("--highlights-file", argv);

  if (grammarFile || highlightsFile) {
    if (!grammarFile || !highlightsFile) {
      throw new Error("Expected both --grammar-file and --highlights-file when using file-based inputs.");
    }

    const grammarPath = resolveArg(grammarFile, grammarFile);
    const highlightsPath = resolveArg(highlightsFile, highlightsFile);

    return {
      grammar: JSON.parse(fs.readFileSync(grammarPath, "utf8")),
      highlightsQuery: fs.readFileSync(highlightsPath, "utf8"),
      metadata: {
        sourceRepo,
        sourcePath: "tree-sitter",
        sourceRef: readOption("--source-ref", argv) ?? "local-files",
        resolvedCommit: readOption("--resolved-commit", argv) ?? ""
      }
    };
  }

  const leoRepo = resolveArg(readOption("--leo-repo", argv), defaultLeoRepo);
  const leoRef = readOption("--leo-ref", argv) ?? defaultLeoRef;
  const resolvedCommit = readLeoFile({
    leoRepo,
    repoRoot,
    args: ["rev-parse", "--verify", `${leoRef}^{commit}`]
  }).trim();

  readLeoFile({
    leoRepo,
    repoRoot,
    args: ["cat-file", "-e", `${leoRef}:tree-sitter/src/grammar.json`]
  });
  readLeoFile({
    leoRepo,
    repoRoot,
    args: ["cat-file", "-e", `${leoRef}:tree-sitter/queries/highlights.scm`]
  });

  return {
    grammar: JSON.parse(
      readLeoFile({
        leoRepo,
        repoRoot,
        args: ["show", `${leoRef}:tree-sitter/src/grammar.json`]
      })
    ),
    highlightsQuery: readLeoFile({
      leoRepo,
      repoRoot,
      args: ["show", `${leoRef}:tree-sitter/queries/highlights.scm`]
    }),
    metadata: {
      sourceRepo,
      sourcePath: "tree-sitter",
      sourceRef: leoRef,
      resolvedCommit
    }
  };
}

function readLeoFile({ leoRepo, repoRoot, args }) {
  return execFileSync("git", ["-C", leoRepo, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}
