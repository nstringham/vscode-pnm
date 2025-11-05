import { ExtensionContext, languages, Position, Range, TextEdit } from "vscode";

export function activate(context: ExtensionContext) {
  const disposable = languages.registerDocumentFormattingEditProvider("pnm", {
    provideDocumentFormattingEdits(document) {
      const edits: TextEdit[] = [];

      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);

        const leadingWhitespace = /^\s+/d.exec(line.text);
        if (leadingWhitespace != null) {
          const [start, end] = leadingWhitespace.indices![0];
          const range = new Range(i, start, i, end);
          edits.push(TextEdit.delete(range));
        }

        const trailingWhitespace = /\s+$/d.exec(line.text);
        if (trailingWhitespace != null) {
          const [start, end] = trailingWhitespace.indices![0];
          const range = new Range(i, start, i, end);
          edits.push(TextEdit.delete(range));
        }

        const commentWithoutSpace = /^[^#]*#[^ ]/.exec(line.text);
        if (commentWithoutSpace != null) {
          const position = new Position(i, commentWithoutSpace[0].length - 1);
          edits.push(TextEdit.insert(position, " "));
        }
      }

      return edits;
    },
  });

  context.subscriptions.push(disposable);
}
