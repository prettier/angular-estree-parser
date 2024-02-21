import transformNode from './transform-node.js';
import transformTemplateBindings from './transform-template-binding.js';
import type { NGMicrosyntax, ParseResult } from './types.js';
import * as angularParser from './angular-parser.js';
import { Context } from './context.js';

function createEstreeParseFunction(
  parse:
    | typeof angularParser.parseBinding
    | typeof angularParser.parseSimpleBinding
    | typeof angularParser.parseInterpolationExpression
    | typeof angularParser.parseAction,
) {
  return (text: string) => {
    const { result: parseResult, comments } = parse(text);
    const context = new Context(text);
    const ast = transformNode(parseResult.ast, context) as ParseResult;
    ast.comments = comments;
    return ast;
  };
}

export const parseBinding = createEstreeParseFunction(
  angularParser.parseBinding,
);

export const parseSimpleBinding = createEstreeParseFunction(
  angularParser.parseSimpleBinding,
);

export const parseInterpolationExpression = createEstreeParseFunction(
  angularParser.parseInterpolationExpression,
);

export const parseAction = createEstreeParseFunction(angularParser.parseAction);

export const parseTemplateBindings = (text: string): NGMicrosyntax => {
  const {
    result: { templateBindings: expressions },
  } = angularParser.parseTemplateBindings(text);

  return transformTemplateBindings(expressions, text);
};
