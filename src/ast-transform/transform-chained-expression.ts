import { type Chain } from '@angular/compiler';
import type * as babel from '@babel/types';

import type { NGChainedExpression } from '../types.ts';
import { type Transformer } from './transform.ts';

export const visitChain = (
  node: Chain,
  transformer: Transformer,
): Omit<NGChainedExpression, 'start' | 'end' | 'range'> => ({
  type: 'NGChainedExpression',
  expressions: transformer.transformChildren<babel.Expression>(
    node.expressions,
  ),
});
