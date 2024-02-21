import {
  Lexer,
  Parser,
  type ASTWithSource,
  type TemplateBindingParseResult,
} from '@angular/compiler';
import { type RawNGComment } from './types.js';

function createParser() {
  return new Parser(new Lexer());
}

function parse<
  T extends ASTWithSource | TemplateBindingParseResult = ASTWithSource,
>(text: string, parse: (text: string, parser: Parser) => T) {
  const parser = createParser();
  const { text: textToParse, comments } = extractComments(text, parser);
  const result = parse(textToParse, parser);

  if (result.errors.length !== 0) {
    const [{ message }] = result.errors;
    throw new SyntaxError(
      message.replace(/^Parser Error: | at column \d+ in [^]*$/g, ''),
    );
  }

  return { result, comments };
}

function parseBinding(text: string) {
  return parse(text, (text, parser) => parser.parseBinding(text, '', 0));
}

function parseSimpleBinding(text: string) {
  return parse(text, (text, parser) => parser.parseSimpleBinding(text, '', 0));
}

function parseAction(text: string) {
  return parse(text, (text, parser) => parser.parseAction(text, '', 0));
}

function parseInterpolationExpression(text: string) {
  return parse(text, (text, parser) =>
    parser.parseInterpolationExpression(text, '', 0),
  );
}

function parseTemplateBindings(text: string) {
  return parse(text, (text, parser) =>
    parser.parseTemplateBindings('', text, '', 0, 0),
  );
}

function extractComments(
  text: string,
  parser: Parser,
): { text: string; comments: RawNGComment[] } {
  // @ts-expect-error -- need to call private _commentStart
  const getCommentStart = parser._commentStart;
  const commentStart: number | null = getCommentStart(text);
  return commentStart === null
    ? { text, comments: [] }
    : {
        text: text.slice(0, commentStart),
        comments: [
          {
            type: 'Comment',
            value: text.slice(commentStart + '//'.length),
            sourceSpan: { start: commentStart, end: text.length },
          },
        ],
      };
}

export {
  parseBinding,
  parseSimpleBinding,
  parseAction,
  parseInterpolationExpression,
  parseTemplateBindings,
};
