import type * as ng from '@angular/compiler';
import transformComment from './transform-comment.js';
import transformNode from './transform-node.js';
import { transformTemplateBindings } from './transform-microsyntax.js';
import type {
  NGNode,
  RawNGComment,
  NGMicrosyntax,
  ParseResult,
} from './types.js';
import * as angularParser from './parser.js';
import { Context } from './context.js';

function createParser(
  parse: (text: string) => {
    result: ng.ASTWithSource;
    comments: RawNGComment[];
  },
) {
  return (text: string) => {
    const { result: parseResult, comments } = parse(text);
    const context = new Context(text);
    const ast = transformNode(parseResult.ast, context) as ParseResult;
    ast.comments = comments.map((comment) => transformComment(comment));
    return ast;
  };
}

export const parseBinding = createParser(angularParser.parseBinding);
export const parseSimpleBinding = createParser(
  angularParser.parseSimpleBinding,
);
export const parseInterpolationExpression = createParser(
  angularParser.parseInterpolationExpression,
);
export const parseAction = createParser(angularParser.parseAction);
export const parseTemplateBindings = (text: string): NGMicrosyntax => {
  const {
    result: { templateBindings: expressions },
  } = angularParser.parseTemplateBindings(text);

  return transformTemplateBindings(expressions, text);
};
export type { NGMicrosyntax, NGNode };
