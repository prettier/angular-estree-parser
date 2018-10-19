import * as ng from '@angular/compiler/src/expression_parser/ast';
import { Lexer } from '@angular/compiler/src/expression_parser/lexer';
import { Parser } from '@angular/compiler/src/expression_parser/parser';
import { RawNGComment } from './types';

const NG_PARSE_FAKE_LOCATION = 'angular-estree-parser';
const NG_PARSE_TEMPLATE_BINDINGS_FAKE_PREFIX = 'NgEstreeParser';

function createNgParser() {
  return new Parser(new Lexer());
}

function parseNg(
  input: string,
  parse: (astInput: string, ngParser: Parser) => ng.ASTWithSource,
) {
  const ngParser = createNgParser();
  const { astInput, comments } = extractComments(input, ngParser);
  const { ast, errors } = parse(astInput, ngParser);
  assertAstErrors(errors);
  return { ast, comments };
}

export function parseNgBinding(input: string) {
  return parseNg(input, (astInput, ngParser) =>
    ngParser.parseBinding(astInput, NG_PARSE_FAKE_LOCATION),
  );
}

export function parseNgSimpleBinding(input: string) {
  return parseNg(input, (astInput, ngParser) =>
    ngParser.parseSimpleBinding(astInput, NG_PARSE_FAKE_LOCATION),
  );
}

export function parseNgAction(input: string) {
  return parseNg(input, (astInput, ngParser) =>
    ngParser.parseAction(astInput, NG_PARSE_FAKE_LOCATION),
  );
}

export function parseNgTemplateBindings(input: string) {
  const ngParser = createNgParser();
  const { templateBindings: ast, errors } = ngParser.parseTemplateBindings(
    NG_PARSE_TEMPLATE_BINDINGS_FAKE_PREFIX,
    input,
    NG_PARSE_FAKE_LOCATION,
  );
  assertAstErrors(errors);
  return ast;
}

export function parseNgInterpolation(input: string) {
  const ngParser = createNgParser();
  const { astInput, comments } = extractComments(input, ngParser);
  const prefix = '{{';
  const suffix = '}}';
  const { ast: rawAst, errors } = ngParser.parseInterpolation(
    prefix + astInput + suffix,
    NG_PARSE_FAKE_LOCATION,
  )!;
  assertAstErrors(errors);
  const ast = (rawAst as ng.Interpolation).expressions[0];
  visitSpan(ast, span => {
    span.start -= prefix.length;
    span.end -= prefix.length;
  });
  return { ast, comments };
}

function visitSpan(ast: any, fn: (span: ng.ParseSpan) => void): void {
  if (!ast || typeof ast !== 'object') {
    return;
  }

  if (Array.isArray(ast)) {
    return ast.forEach(value => visitSpan(value, fn));
  }

  for (const key of Object.keys(ast)) {
    const value = ast[key];
    if (key === 'span') {
      fn(value);
    } else {
      visitSpan(value, fn);
    }
  }
}

function assertAstErrors(errors: ng.ParserError[]) {
  if (errors.length !== 0) {
    const [{ message }] = errors;
    throw new SyntaxError(
      message.replace(/^Parser Error: | at column \d+ in [^]*$/g, ''),
    );
  }
}

function extractComments(
  input: string,
  ngParser: Parser,
): { astInput: string; comments: RawNGComment[] } {
  // @ts-ignore
  const commentStart: number | null = ngParser._commentStart(input);
  return commentStart === null
    ? { astInput: input, comments: [] }
    : {
        astInput: input.slice(0, commentStart),
        comments: [
          {
            type: 'Comment',
            value: input.slice(commentStart + '//'.length),
            span: { start: commentStart, end: input.length },
          },
        ],
      };
}

// prettier-ignore
export function getNgType(node: (ng.AST | RawNGComment) & { type?: string }) {
  if (node instanceof ng.Binary) { return 'Binary'; }
  if (node instanceof ng.BindingPipe) { return "BindingPipe"; }
  if (node instanceof ng.Chain) { return "Chain"; }
  if (node instanceof ng.Conditional) { return "Conditional"; }
  if (node instanceof ng.EmptyExpr) { return "EmptyExpr"; }
  if (node instanceof ng.FunctionCall) { return "FunctionCall"; }
  if (node instanceof ng.ImplicitReceiver) { return "ImplicitReceiver"; }
  if (node instanceof ng.KeyedRead) { return "KeyedRead"; }
  if (node instanceof ng.KeyedWrite) { return "KeyedWrite"; }
  if (node instanceof ng.LiteralArray) { return "LiteralArray"; }
  if (node instanceof ng.LiteralMap) { return "LiteralMap"; }
  if (node instanceof ng.LiteralPrimitive) { return "LiteralPrimitive"; }
  if (node instanceof ng.MethodCall) { return "MethodCall"; }
  if (node instanceof ng.NonNullAssert) { return "NonNullAssert"; }
  if (node instanceof ng.PrefixNot) { return "PrefixNot"; }
  if (node instanceof ng.PropertyRead) { return "PropertyRead"; }
  if (node instanceof ng.PropertyWrite) { return "PropertyWrite"; }
  if (node instanceof ng.Quote) { return "Quote"; }
  if (node instanceof ng.SafeMethodCall) { return "SafeMethodCall"; }
  if (node instanceof ng.SafePropertyRead) { return "SafePropertyRead"; }
  return node.type;
}

export function stripSurroundingSpaces(
  startIndex: number,
  endIndex: number,
  text: string,
) {
  let start = startIndex;
  let end = endIndex;

  while (end !== start && /\s/.test(text[end - 1])) {
    end--;
  }

  while (start !== end && /\s/.test(text[start])) {
    start++;
  }

  return { start, end };
}

export function findFrontChar(regex: RegExp, index: number, text: string) {
  let i = index;
  while (!regex.test(text[i])) {
    i--;
  }
  return i;
}

export function findBackChar(regex: RegExp, index: number, text: string) {
  let i = index;
  while (!regex.test(text[i])) {
    i++;
  }
  return i;
}

export function toLowerCamelCase(str: string) {
  return str.slice(0, 1).toLowerCase() + str.slice(1);
}
