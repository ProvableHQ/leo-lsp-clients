import * as vscode from "vscode";

import { createLeoDefinitionProvider } from "./definitionProvider";

export function activate(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [{ language: "leo", scheme: "file" }];

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(selector, createLeoDefinitionProvider())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("leo-extension.about", async () => {
      await vscode.window.showInformationMessage(
        "Leo 4.0 support is scaffolded with client-side highlighting and approximate go-to-definition. Tree-sitter assets sync from the Leo monorepo."
      );
    })
  );
}

export function deactivate(): void {}

