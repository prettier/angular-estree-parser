import * as ng from '@angular/compiler/src/expression_parser/ast';
import { Context } from './context';
import { InputNode, transform } from './transform';
import { NGNode, RawNGComment } from './types';
import {
  parseNgAction,
  parseNgBinding,
  parseNgInterpolation,
  parseNgSimpleBinding,
} from './utils';

function parse(
  input: string,
  parseNg: (input: string) => { ast: ng.AST; comments: RawNGComment[] },
) {
  const { ast: rawNgAst, comments } = parseNg(input);
  const context = new Context(input);
  const _t = (n: InputNode) => transform(n, context);
  const ast = _t(rawNgAst) as NGNode;
  ast.comments = comments.map(_t);
  return ast;
}

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
