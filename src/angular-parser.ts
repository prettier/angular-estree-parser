import {
  type ASTWithSource,
  Lexer,
  ParseError,
  ParseLocation,
  Parser,
  ParseSourceFile,
  ParseSourceSpan,
  type TemplateBindingParseResult,
} from '@angular/compiler';

import { type CommentLine } from './types.ts';
import { sourceSpanToLocationInformation } from './utilities.ts';

const FILE_NAME = 'test.html';

type ParseContext = {
  text: string;
  file: ParseSourceFile;
  start: ParseLocation;
  end: ParseLocation;
  sourceSpan: ParseSourceSpan;
};

// https://github.com/angular/angular/blob/5e9707dc84e6590ec8c9d41e7d3be7deb2fa7c53/packages/compiler/test/expression_parser/utils/span.ts
function getParseSourceSpan(text: string): ParseContext {
  const file = new ParseSourceFile(text, FILE_NAME);
  const start = new ParseLocation(file, 0, 0, 0);
  const end = start.moveBy(text.length);
  const sourceSpan = new ParseSourceSpan(start, end);
  return {
    text,
    file,
    start,
    end,
    sourceSpan,
  };
}

let parser: Parser;
function getParser() {
  return (parser ??= new Parser(new Lexer()));
}

const getCommentStart = (text: string): number | null =>
  // @ts-expect-error -- need to call private _commentStart
  Parser.prototype._commentStart(text);

function extractComments(text: string) {
  const commentStart = getCommentStart(text);

  if (commentStart === null) {
    return [];
  }

  const comment: CommentLine = {
    type: 'CommentLine',
    value: text.slice(commentStart + '//'.length),
    ...sourceSpanToLocationInformation({
      start: commentStart,
      end: text.length,
    }),
  };

  return [comment];
}

function throwErrors<
  ResultType extends ASTWithSource | TemplateBindingParseResult,
>(
  parseResult: ParseContext & {
    result: ResultType;
    comments: CommentLine[];
  },
) {
  const { result } = parseResult;

  if (result.errors.length !== 0) {
    const [originalError] = result.errors;

    /* c8 ignore next 3 @preserve */
    if (!(originalError instanceof ParseError)) {
      throw originalError;
    }

    let { message } = originalError;
    {
      const match = message.match(/ in .*?@\d+:\d+$/);
      if (match) {
        message = message.slice(0, match.index);
      }
    }

    let location = parseResult.start;
    {
      const match = message.match(/at column (?<index>\d+)/);
      if (match) {
        message = message.slice(0, match.index);
        location = location.moveBy(Number(match.groups!.index));
      }
    }

    const error = new SyntaxError(message.trim(), { cause: originalError });
    Object.assign(error, {
      location,
      span: originalError.span,
    });
    error.cause ??= originalError;

    throw error;
  }

  return parseResult;
}

const createAstParser =
  (
    name:
      | 'parseBinding'
      | 'parseSimpleBinding'
      | 'parseAction'
      | 'parseInterpolationExpression',
  ) =>
  (text: string) => {
    const context = getParseSourceSpan(text);
    return throwErrors<ASTWithSource>({
      ...context,
      result: getParser()[name](text, context.sourceSpan, 0),
      comments: extractComments(text),
    });
  };

export const parseAction = createAstParser('parseAction');
export const parseBinding = createAstParser('parseBinding');
export const parseSimpleBinding = createAstParser('parseSimpleBinding');
export const parseInterpolationExpression = createAstParser(
  'parseInterpolationExpression',
);
export const parseTemplateBindings = (text: string) => {
  const context = getParseSourceSpan(text);
  return throwErrors<TemplateBindingParseResult>({
    ...context,
    result: getParser().parseTemplateBindings(
      '',
      text,
      context.sourceSpan,
      0,
      0,
    ),
    comments: [],
  });
};
