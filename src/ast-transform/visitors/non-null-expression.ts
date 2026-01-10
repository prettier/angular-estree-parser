import { type NonNullAssert } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type NodeTransformer } from '../node-transformer.ts';

export const visitNonNullAssert = (
  node: NonNullAssert,
  transformer: NodeTransformer,
): babel.TSNonNullExpression => ({
  type: 'TSNonNullExpression',
  expression: transformer.transformChild<babel.Expression>(node.expression),
});
