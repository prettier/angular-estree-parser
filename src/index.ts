import type * as ng from '@angular/compiler';
import {
  transformNode,
  transformComment,
  transformTemplateBindings,
} from './transform.js';
import type { NGNode, RawNGComment, NGMicrosyntax } from './types.js';
import * as angularParser from './parser.js';
import { type default as Context } from './context.js';

function createParser(
  parse: (text: string) => {
    ast: ng.AST;
    comments: RawNGComment[];
    context: Context;
  },
) {
  return (text: string) => {
    const { ast: rawNgAst, comments, context } = parse(text);
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
export const parseTemplateBindings = (text: string): NGMicrosyntax =>
  transformTemplateBindings(angularParser.parseTemplateBindings(text));
export type { NGMicrosyntax, NGNode };
