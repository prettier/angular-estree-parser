import type * as ng from '@angular/compiler';
import { Context } from './context.js';
import {
  transformNode,
  transformComment,
  transformTemplateBindings,
} from './transform.js';
import type { NGNode, RawNGComment, NGMicrosyntax } from './types.js';
import * as angularParser from './parser.js';

function createParser(
  parse: (input: string) => { ast: ng.AST; comments: RawNGComment[] },
) {
  return (input: string) => {
    const { ast: rawNgAst, comments } = parse(input);
    const context = new Context(input);
    const ast = transformNode(rawNgAst, context);
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
export const parseTemplateBindings = (input: string): NGMicrosyntax =>
  transformTemplateBindings(
    angularParser.parseTemplateBindings(input),
    new Context(input),
  );
export type { NGMicrosyntax, NGNode };
