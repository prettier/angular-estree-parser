import { type ArrowFunction, type AstVisitor } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type NodeTransformer } from '../node-transformer.ts';

const commonProperties = {
  id: null,
  generator: false,
  async: false,
  expression: true,
} as const;

export const visitArrowFunction: AstVisitor['visitArrowFunction'] = (
  node: ArrowFunction,
  transformer: NodeTransformer,
): babel.ArrowFunctionExpression & { id: null } => ({
  type: 'ArrowFunctionExpression',
  params: node.parameters.map((parameter) =>
    transformer.createNode<babel.Identifier>(
      { type: 'Identifier', name: parameter.name },
      parameter.sourceSpan,
    ),
  ),
  body: transformer.transformChild<babel.Expression>(node.body),
  ...commonProperties,
});
