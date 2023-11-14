import type * as ng from '@angular/compiler';
import type * as b from '@babel/types';
import { Context } from './context.js';
import { transform } from './transform.js';
import { transformTemplateBindings } from './transform-microsyntax.js';
import type { NGNode, RawNGComment, NGMicrosyntax } from './types.js';
import * as angularParser from './parser.js';

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
