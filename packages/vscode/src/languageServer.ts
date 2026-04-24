import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { Executable, LanguageClient, LanguageClientOptions } from "vscode-languageclient/node";

const OUTPUT_CHANNEL_NAME = "Leo Language Server";
const SERVER_COMMAND = "leo-lsp";
const LANGUAGE_SERVER_PATH_SETTING = "languageServer.path";
const LANGUAGE_SERVER_ARGS_SETTING = "languageServer.args";

let client: LanguageClient | undefined;

/**
 * Start `leo-lsp` when a local executable is available and otherwise keep the
 * extension in its syntax-only fallback mode.
 */
export function activateLeoLanguageServer(
  context: vscode.ExtensionContext,
  documentSelector: LanguageClientOptions["documentSelector"]
): void {
  const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  context.subscriptions.push(outputChannel);

  const executable = resolveServerExecutable(outputChannel);
  if (!executable) {
    outputChannel.appendLine("leo-lsp was not found; continuing with tree-sitter-derived fallback support.");
    return;
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector,
    outputChannel
  };

  outputChannel.appendLine(`Starting leo-lsp from ${executable.command}`);
  const languageClient = new LanguageClient("leo-lsp", "Leo Language Server", executable, clientOptions);

  client = languageClient;
  void languageClient.start().then(
    () => {
      outputChannel.appendLine("leo-lsp started.");
    },
    error => {
      outputChannel.appendLine(`Failed to start leo-lsp: ${describeError(error)}`);
      if (client === languageClient) {
        client = undefined;
      }
    }
  );

  context.subscriptions.push({
    dispose: () => {
      if (client === languageClient) {
        client = undefined;
      }
      void languageClient.stop();
    }
  });
}

/** Stop the optional language server when the extension deactivates. */
export function deactivateLeoLanguageServer(): Thenable<void> | undefined {
  const activeClient = client;
  client = undefined;
  return activeClient?.stop();
}

/** Resolve the executable and arguments used to launch the Leo language server. */
function resolveServerExecutable(outputChannel: vscode.OutputChannel): Executable | undefined {
  const configuration = vscode.workspace.getConfiguration("leo");
  const configuredPath = configuration.get<string>(LANGUAGE_SERVER_PATH_SETTING)?.trim() ?? "";
  const configuredArgs = configuration.get<string[]>(LANGUAGE_SERVER_ARGS_SETTING) ?? [];

  if (configuredPath.length > 0) {
    for (const candidate of configuredServerPathCandidates(configuredPath)) {
      if (isExecutableFile(candidate)) {
        outputChannel.appendLine(`Using configured leo.languageServer.path: ${candidate}`);
        return { command: candidate, args: configuredArgs };
      }
    }

    outputChannel.appendLine(
      `Configured leo.languageServer.path did not resolve to an executable: ${configuredPath}`
    );
  }

  for (const candidate of automaticServerPathCandidates()) {
    if (!isExecutableFile(candidate)) {
      continue;
    }

    outputChannel.appendLine(`Discovered leo-lsp at ${candidate}`);
    return { command: candidate, args: configuredArgs };
  }

  return undefined;
}

/** Expand an explicit extension setting into absolute candidate paths. */
function configuredServerPathCandidates(configuredPath: string): string[] {
  const expanded = expandHomeDirectory(configuredPath);
  if (path.isAbsolute(expanded)) {
    return [expanded];
  }

  const candidates = [path.resolve(expanded)];
  for (const workspaceFolder of vscode.workspace.workspaceFolders ?? []) {
    candidates.push(path.resolve(workspaceFolder.uri.fsPath, expanded));
  }
  return uniqueCandidates(candidates);
}

/** Search the most common local-development locations for `leo-lsp`. */
function automaticServerPathCandidates(): string[] {
  const candidates: string[] = [];
  const executableName = platformExecutableName(SERVER_COMMAND);

  const cargoHome = process.env.CARGO_HOME?.trim();
  if (cargoHome) {
    candidates.push(path.join(cargoHome, "bin", executableName));
  }
  candidates.push(path.join(os.homedir(), ".cargo", "bin", executableName));

  for (const pathEntry of (process.env.PATH ?? "").split(path.delimiter)) {
    if (pathEntry.length === 0) {
      continue;
    }
    candidates.push(path.join(pathEntry, executableName));
  }

  for (const workspaceFolder of vscode.workspace.workspaceFolders ?? []) {
    candidates.push(path.join(workspaceFolder.uri.fsPath, "target", "debug", executableName));
    candidates.push(path.join(workspaceFolder.uri.fsPath, "target", "release", executableName));
  }

  return uniqueCandidates(candidates);
}

/** Normalize away duplicate search locations while preserving search order. */
function uniqueCandidates(candidates: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    unique.push(candidate);
  }

  return unique;
}

/** Expand `~/...` paths from extension settings into absolute filesystem paths. */
function expandHomeDirectory(candidate: string): string {
  if (candidate === "~") {
    return os.homedir();
  }

  if (candidate.startsWith(`~${path.sep}`)) {
    return path.join(os.homedir(), candidate.slice(2));
  }

  return candidate;
}

/** Check whether a candidate path exists and can be executed by the extension host. */
function isExecutableFile(candidate: string): boolean {
  const accessMode = process.platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK;

  try {
    if (!fs.statSync(candidate).isFile()) {
      return false;
    }

    fs.accessSync(candidate, accessMode);
    return true;
  } catch {
    return false;
  }
}

/** Apply the platform-specific executable suffix expected by the filesystem. */
function platformExecutableName(command: string): string {
  return process.platform === "win32" ? `${command}.exe` : command;
}

/** Keep startup logging readable without assuming the thrown value is an `Error`. */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
