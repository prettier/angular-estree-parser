import {
  Lexer,
  Parser,
  type ASTWithSource,
  type Interpolation,
  type ParserError,
} from '@angular/compiler';
import { type RawNGComment } from './types.js';
import { Context } from './context.js';

function createParser() {
  return new Parser(new Lexer());
}

function parse(
  text: string,
  parse: (text: string, parser: Parser) => ASTWithSource,
) {
  const context = new Context(text);
  const parser = createParser();
  const { text: textToParse, comments } = extractComments(text, parser);
  const { ast, errors } = parse(textToParse, parser);
  assertAstErrors(errors);
  return { ast, comments, context };
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
  return parse(text, (text, parser) => {
    const result = parser.parseInterpolationExpression(text, '', 0);
    result.ast = (result.ast as Interpolation).expressions[0];
    return result;
  });
}

function parseTemplateBindings(text: string) {
  const context = new Context(text);
  const parser = createParser();
  const { templateBindings: expressions, errors } =
    parser.parseTemplateBindings('', text, '', 0, 0);
  assertAstErrors(errors);
  return { expressions, context };
}

function assertAstErrors(errors: ParserError[]) {
  if (errors.length !== 0) {
    const [{ message }] = errors;
    throw new SyntaxError(
      message.replace(/^Parser Error: | at column \d+ in [^]*$/g, ''),
    );
  }
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
