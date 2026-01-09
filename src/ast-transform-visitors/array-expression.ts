import { type LiteralArray } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type NodeTransformer } from '../ast-transform/node-transformer.ts';

export const visitLiteralArray = (
  node: LiteralArray,
  transformer: NodeTransformer,
): babel.ArrayExpression => ({
  type: 'ArrayExpression',
  elements: transformer.transformChildren<
    babel.Expression | babel.SpreadElement
  >(node.expressions),
});
