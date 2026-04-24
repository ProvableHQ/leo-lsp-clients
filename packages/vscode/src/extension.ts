import * as vscode from "vscode";

import { createLeoDefinitionProvider } from "./definitionProvider";
import { activateLeoLanguageServer, deactivateLeoLanguageServer } from "./languageServer";

export function activate(context: vscode.ExtensionContext): void {
  const selector = [{ language: "leo", scheme: "file" }];
  activateLeoLanguageServer(context, selector);

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(selector, createLeoDefinitionProvider())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("leo-extension.about", async () => {
      await vscode.window.showInformationMessage(
        "Leo 4.0 support includes tree-sitter-derived syntax tooling, approximate go-to-definition, and optional leo-lsp startup when the binary is available."
      );
    })
  );
}

export function deactivate(): Thenable<void> | undefined {
  return deactivateLeoLanguageServer();
}
