import { Diagnostic, DiagnosticCollection, Disposable, languages, TextDocument, workspace } from "vscode";
import { LANGUAGE_ID } from "./extension";
import { Parser } from "./parser";

export function startDiagnostics(): Disposable {
  const diagnosticCollection = languages.createDiagnosticCollection(LANGUAGE_ID);

  const openDetector = workspace.onDidOpenTextDocument((document) => updateDiagnostics(document, diagnosticCollection));

  const saveDetector = workspace.onDidSaveTextDocument((document) => updateDiagnostics(document, diagnosticCollection));

  let changeTimeout: NodeJS.Timeout;
  const changeDetector = workspace.onDidChangeTextDocument((changes) => {
    clearTimeout(changeTimeout);
    changeTimeout = setTimeout(updateDiagnostics, 300, changes.document, diagnosticCollection);
  });

  return Disposable.from(diagnosticCollection, openDetector, saveDetector, changeDetector);
}

function updateDiagnostics(document: TextDocument, collection: DiagnosticCollection) {
  collection.delete(document.uri);
  if (document.languageId === LANGUAGE_ID) {
    try {
      validateDocument(document);
    } catch (error) {
      if (error instanceof Diagnostic) {
        collection.set(document.uri, [error]);
      } else {
        throw error;
      }
    }
  }
}

function validateDocument(document: TextDocument): void {
  const parser = new Parser(document);

  const fileType = parser.expectMagicNumber();

  const width = parser.expectInteger("height", 1, Number.MAX_SAFE_INTEGER).value;

  const height = parser.expectInteger("width", 1, Number.MAX_SAFE_INTEGER).value;

  const maxValue = fileType === "P1" ? 1 : parser.expectInteger("max value", 1, 65535).value;

  for (let i = 0; i < width * height; i++) {
    if (fileType === "P3") {
      parser.expectInteger("red", 0, maxValue);
      parser.expectInteger("green", 0, maxValue);
      parser.expectInteger("blue", 0, maxValue);
    } else {
      parser.expectInteger("value", 0, maxValue);
    }
  }

  parser.expectEndOfFile();
}
