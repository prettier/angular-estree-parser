import { type Chain } from '@angular/compiler';
import type * as babel from '@babel/types';

import type { NGChainedExpression } from '../types.ts';
import { type NodeTransformer } from '../ast-transform/node-transformer.ts';

export const visitChain = (
  node: Chain,
  transformer: NodeTransformer,
): Omit<NGChainedExpression, 'start' | 'end' | 'range'> => ({
  type: 'NGChainedExpression',
  expressions: transformer.transformChildren<babel.Expression>(
    node.expressions,
  ),
});
