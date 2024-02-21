import {
  Lexer,
  Parser,
  type ASTWithSource,
  type Interpolation,
  type ParserError,
} from '@angular/compiler';
import { type RawNGComment } from './types.js';
import { Context } from './context.js';

const NG_PARSE_FAKE_LOCATION = 'angular-estree-parser';
const NG_PARSE_TEMPLATE_BINDINGS_FAKE_PREFIX = 'NgEstreeParser';
const NG_PARSE_FAKE_ABSOLUTE_OFFSET = 0;
const NG_PARSE_SHARED_PARAMS: readonly [string, number] = [
  NG_PARSE_FAKE_LOCATION,
  NG_PARSE_FAKE_ABSOLUTE_OFFSET,
];

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
  return parse(text, (text, parser) =>
    parser.parseBinding(text, ...NG_PARSE_SHARED_PARAMS),
  );
}

function parseSimpleBinding(text: string) {
  return parse(text, (text, parser) =>
    parser.parseSimpleBinding(text, ...NG_PARSE_SHARED_PARAMS),
  );
}

function parseAction(text: string) {
  return parse(text, (text, parser) =>
    parser.parseAction(text, ...NG_PARSE_SHARED_PARAMS),
  );
}

function parseInterpolationExpression(text: string) {
  return parse(text, (text, parser) => {
    const result = parser.parseInterpolationExpression(
      text,
      ...NG_PARSE_SHARED_PARAMS,
    );
    result.ast = (result.ast as Interpolation).expressions[0];
    return result;
  });
}

function parseTemplateBindings(text: string) {
  const context = new Context(text);
  const parser = createParser();
  const { templateBindings: expressions, errors } =
    parser.parseTemplateBindings(
      NG_PARSE_TEMPLATE_BINDINGS_FAKE_PREFIX,
      text,
      NG_PARSE_FAKE_LOCATION,
      NG_PARSE_FAKE_ABSOLUTE_OFFSET,
      NG_PARSE_FAKE_ABSOLUTE_OFFSET,
    );
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
  NG_PARSE_TEMPLATE_BINDINGS_FAKE_PREFIX,
  parseBinding,
  parseSimpleBinding,
  parseAction,
  parseInterpolationExpression,
  parseTemplateBindings,
};
