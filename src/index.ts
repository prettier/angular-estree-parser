import type * as ng from '@angular/compiler';
import type * as b from '@babel/types';
import { Context } from './context.js';
import { transform } from './transform.js';
import { transformTemplateBindings } from './transform-microsyntax.js';
import type { NGNode, RawNGComment, NGMicrosyntax } from './types.js';
import {
  parseNgAction,
  parseNgBinding,
  parseNgInterpolationExpression,
  parseNgSimpleBinding,
  parseNgTemplateBindings,
} from './utils.js';

function createParser(
  parse: (input: string) => { ast: ng.AST; comments: RawNGComment[] },
) {
  return (input: string) => {
    const { ast: rawNgAst, comments } = parse(input);
    const context = new Context(input);
    const ast = transform(rawNgAst, context) as NGNode;
    ast.comments = comments.map((comment) =>
      transform(comment, context),
    ) as b.CommentLine[];
    return ast;
  };
}

export const parseBinding = createParser(parseNgBinding);
export const parseSimpleBinding = createParser(parseNgSimpleBinding);
export const parseInterpolationExpression = createParser(
  parseNgInterpolationExpression,
);
export const parseAction = createParser(parseNgAction);
export const parseTemplateBindings = (input: string): NGMicrosyntax =>
  transformTemplateBindings(parseNgTemplateBindings(input), new Context(input));
export type { NGMicrosyntax, NGNode };
