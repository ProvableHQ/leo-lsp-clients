import * as vscode from "vscode";

import { createLeoDefinitionProvider } from "./definitionProvider";
import { activateLeoLanguageServer, deactivateLeoLanguageServer } from "./languageServer";

export function activate(context: vscode.ExtensionContext): void {
  const selector = [{ language: "leo", scheme: "file" }];
  const languageServerLaunchAttempted = activateLeoLanguageServer(context, selector);

  if (!languageServerLaunchAttempted) {
    context.subscriptions.push(
      vscode.languages.registerDefinitionProvider(selector, createLeoDefinitionProvider())
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("leo-extension.about", async () => {
      await vscode.window.showInformationMessage(
        "Leo 4.0 support includes tree-sitter-derived syntax tooling, optional leo-lsp startup, LSP-backed go-to-definition when leo-lsp is available, and approximate fallback definitions when it is not."
      );
    })
  );
}

export function deactivate(): Thenable<void> | undefined {
  return deactivateLeoLanguageServer();
}
