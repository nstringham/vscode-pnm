import { ExtensionContext, languages } from "vscode";
import { formatter } from "./formatter";
import { startDiagnostics } from "./diagnostics";

export const LANGUAGE_ID = "pnm";

export function activate(context: ExtensionContext) {
  context.subscriptions.push(languages.registerDocumentFormattingEditProvider(LANGUAGE_ID, formatter));

  context.subscriptions.push(startDiagnostics());
}
