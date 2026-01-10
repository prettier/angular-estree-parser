import { type LiteralArray } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type NodeTransformer } from '../node-transformer.ts';

export const visitLiteralArray = (
  node: LiteralArray,
  transformer: NodeTransformer,
): babel.ArrayExpression => ({
  type: 'ArrayExpression',
  elements: transformer.transformChildren<
    Exclude<babel.ArrayExpression['elements'][number], null>
  >(node.expressions),
});
