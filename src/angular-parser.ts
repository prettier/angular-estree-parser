import {
  type ASTWithSource,
  Lexer,
  ParseLocation,
  Parser,
  ParseSourceFile,
  ParseSourceSpan,
  type TemplateBindingParseResult,
} from '@angular/compiler';

import { type CommentLine } from './types.ts';
import { sourceSpanToLocationInformation } from './utils.ts';

let parseSourceSpan: ParseSourceSpan;
// https://github.com/angular/angular/blob/5e9707dc84e6590ec8c9d41e7d3be7deb2fa7c53/packages/compiler/test/expression_parser/utils/span.ts
function getParseSourceSpan() {
  if (!parseSourceSpan) {
    const file = new ParseSourceFile('', 'test.html');
    const location = new ParseLocation(file, -1, -1, -1);
    parseSourceSpan = new ParseSourceSpan(location, location);
  }

  return parseSourceSpan;
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
>(result: ResultType) {
  if (result.errors.length !== 0) {
    const [{ message }] = result.errors;
    throw new SyntaxError(
      message.replace(/^Parser Error: | at column \d+ in [^]*$/g, ''),
    );
  }

  return result;
}

const createAstParser =
  (
    name:
      | 'parseBinding'
      | 'parseSimpleBinding'
      | 'parseAction'
      | 'parseInterpolationExpression',
  ) =>
  (text: string) => ({
    result: throwErrors<ASTWithSource>(
      getParser()[name](text, getParseSourceSpan(), 0),
    ),
    text,
    comments: extractComments(text),
  });

export const parseAction = createAstParser('parseAction');
export const parseBinding = createAstParser('parseBinding');
export const parseSimpleBinding = createAstParser('parseSimpleBinding');
export const parseInterpolationExpression = createAstParser(
  'parseInterpolationExpression',
);
export const parseTemplateBindings = (text: string) => ({
  result: throwErrors<TemplateBindingParseResult>(
    getParser().parseTemplateBindings('', text, getParseSourceSpan(), 0, 0),
  ),
  text,
  comments: [],
});
