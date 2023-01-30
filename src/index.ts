import type * as ng from '@angular/compiler';
import type * as b from '@babel/types';
import { Context } from './context.js';
import { InputNode, transform } from './transform.js';
import { transformTemplateBindings } from './transform-microsyntax.js';
import type { NGMicrosyntax, NGNode, RawNGComment } from './types.js';
import {
  parseNgAction,
  parseNgBinding,
  parseNgInterpolationExpression,
  parseNgSimpleBinding,
  parseNgTemplateBindings,
} from './utils.js';

function parse(
  input: string,
  parseNg: (input: string) => { ast: ng.AST; comments: RawNGComment[] },
) {
  const { ast: rawNgAst, comments } = parseNg(input);
  const context = new Context(input);
  const _t = (n: InputNode) => transform(n, context);
  const ast = _t(rawNgAst) as NGNode;
  ast.comments = comments.map((comment) => _t(comment) as b.CommentLine);
  return ast;
}

export { NGMicrosyntax, NGNode };

export function parseBinding(input: string): NGNode {
  return parse(input, parseNgBinding);
}

export function parseSimpleBinding(input: string): NGNode {
  return parse(input, parseNgSimpleBinding);
}

export function parseInterpolationExpression(input: string): NGNode {
  return parse(input, parseNgInterpolationExpression);
}

export function parseAction(input: string): NGNode {
  return parse(input, parseNgAction);
}

export function parseTemplateBindings(input: string): NGMicrosyntax {
  return transformTemplateBindings(
    parseNgTemplateBindings(input),
    new Context(input),
  );
}

// TODO: Remove this in next major
export const parseInterpolation = parseInterpolationExpression;
