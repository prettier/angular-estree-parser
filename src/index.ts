import type * as ng from '@angular/compiler';
import {
  transformNode,
  transformComment,
  transformTemplateBindings,
} from './transform.js';
import type {
  NGNode,
  RawNGComment,
  NGMicrosyntax,
  ParseResult,
} from './types.js';
import * as angularParser from './parser.js';
import { type Context } from './context.js';

function createParser(
  parse: (text: string) => {
    ast: ng.AST;
    comments: RawNGComment[];
    context: Context;
  },
) {
  return (text: string) => {
    const { ast: angularNode, comments, context } = parse(text);
    const ast = transformNode(angularNode, context) as ParseResult;
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
