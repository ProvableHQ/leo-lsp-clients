import * as vscode from "vscode";

import { createLeoDefinitionProvider } from "./definitionProvider";
import {
  activateLeoLanguageServer,
  deactivateLeoLanguageServer,
  SUPPORTED_LEO_LSP_VERSION
} from "./languageServer";

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
        `Leo includes tree-sitter-derived syntax tooling, optional leo-lsp startup, LSP-backed go-to-definition, and approximate fallback definitions. This extension is tested with leo-lsp ${SUPPORTED_LEO_LSP_VERSION}.`
      );
    })
  );
}

export function deactivate(): Thenable<void> | undefined {
  return deactivateLeoLanguageServer();
}
