import { type Chain } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type NodeTransformer } from '../node-transformer.ts';
import type { NGChainedExpression } from '../node-types.ts';

export const visitChain = (
  node: Chain,
  transformer: NodeTransformer,
): Omit<NGChainedExpression, 'start' | 'end' | 'range'> => ({
  type: 'NGChainedExpression',
  expressions: transformer.transformChildren<babel.Expression>(
    node.expressions,
  ),
});
