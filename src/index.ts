import * as ng from '@angular/compiler/es2015/src/expression_parser/ast.js';
import * as b from '@babel/types';
import { Context } from './context.js';
import { InputNode, transform } from './transform.js';
import { transformTemplateBindings } from './transform-microsyntax.js';
import type { NGMicrosyntax, NGNode, RawNGComment } from './types';
import {
  parseNgAction,
  parseNgBinding,
  parseNgInterpolation,
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

export function parseInterpolation(input: string): NGNode {
  return parse(input, parseNgInterpolation);
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
