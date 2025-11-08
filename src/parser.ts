import { Diagnostic, Position, Range, TextDocument } from "vscode";

type Token = {
  type: "magic-number" | "integer" | "whitespace" | "comment" | "invalid" | "end-of-file";
  content: string;
  range: Range;
};

class Tokenizer {
  private nextLine = 0;
  private remainingTokens: Token[] = [];

  constructor(private document: TextDocument) {}

  nextToken(): Token {
    if (this.remainingTokens.length == 0) {
      this.tokenizeNextLine();
    }
    const token = this.remainingTokens.shift();
    if (token == undefined) {
      const eof = this.document.lineAt(this.document.lineCount - 1).range.end;
      return {
        type: "end-of-file",
        content: "",
        range: new Range(eof, eof),
      };
    }
    return token;
  }

  private tokenizeNextLine() {
    if (this.nextLine == this.document.lineCount) {
      return;
    }

    const line = this.document.getText(this.document.lineAt(this.nextLine).rangeIncludingLineBreak);

    const matches = line.matchAll(/(?:[^\s#]+)|(?:\s+)|(?:#.*$)/dgm);

    for (const match of matches) {
      const content = match[0];
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- indices always exists because regex has the `d` flag
      const [start, end] = match.indices![0];

      let type: Token["type"];

      if (/^P[123]$/.test(content)) {
        type = "magic-number";
      } else if (/^\d+$/.test(content)) {
        type = "integer";
      } else if (/^\s+$/.test(content)) {
        type = "whitespace";
      } else if (/^#.*$/.test(content)) {
        type = "comment";
      } else {
        type = "invalid";
      }

      this.remainingTokens.push({
        type,
        content,
        range: new Range(new Position(this.nextLine, start), new Position(this.nextLine, end)),
      });
    }

    this.nextLine++;
  }
}

export type FileType = "P1" | "P2" | "P3";

export const fileTypeNames: { [key in FileType]: string } = {
  P1: "Portable BitMap",
  P2: "Portable GrayMap",
  P3: "Portable PixMap",
};

export type Integer = {
  value: number;
  range: Range;
};

export class Parser {
  private tokenizer: Tokenizer;
  private fileType: FileType | undefined;

  constructor(document: TextDocument) {
    this.tokenizer = new Tokenizer(document);
    if (document.uri.scheme == "file") {
      if (document.uri.path.endsWith(".pbm")) {
        this.fileType = "P1";
      } else if (document.uri.path.endsWith(".pgm")) {
        this.fileType = "P2";
      } else if (document.uri.path.endsWith(".ppm")) {
        this.fileType = "P3";
      }
    }
  }

  expectMagicNumber(): FileType {
    const token = this.tokenizer.nextToken();
    if (token.type != "magic-number" || (this.fileType != undefined && this.fileType != token.content)) {
      const range = new Range(new Position(0, 0), new Position(0, 2));
      if (this.fileType != undefined) {
        throw new ParsingError(range, `${fileTypeNames[this.fileType]} files must start with "${this.fileType}"`);
      } else {
        throw new ParsingError(range, `Netpbm files must start with "P1", "P2", or "P3"`);
      }
    }
    this.fileType = token.content as FileType;
    return this.fileType;
  }

  expectInteger(name: string, min: number, max: number): Integer {
    while (true) {
      const token = this.tokenizer.nextToken();
      switch (token.type) {
        case "integer": {
          const value = parseInt(token.content, 10);
          if (value < min) {
            throw new ParsingError(token.range, `${name} must be at least ${min.toFixed()}`);
          }
          if (value > max) {
            throw new ParsingError(token.range, `${name} cannot be more than ${max.toFixed()}`);
          }

          return {
            value,
            range: token.range,
          };
        }

        case "whitespace":
        case "comment":
          continue;

        case "magic-number":
        case "invalid":
          throw new ParsingError(token.range, `Invalid ${name}. "${token.content}" is not an integer`);

        case "end-of-file":
          throw new ParsingError(token.range, `Missing ${name}. Please provide an integer`);
      }
    }
  }

  expectEndOfFile() {
    while (true) {
      const token = this.tokenizer.nextToken();
      switch (token.type) {
        case "end-of-file":
          return;

        case "whitespace":
        case "comment":
          continue;

        case "integer":
        case "magic-number":
        case "invalid":
          throw new ParsingError(token.range, `Expected end of file but found ${token.content}`);
      }
    }
  }
}

export class ParsingError extends Error {
  constructor(
    public readonly range: Range,
    message: string,
  ) {
    super(message);
  }

  toDiagnostic(): Diagnostic {
    return new Diagnostic(this.range, this.message);
  }
}
