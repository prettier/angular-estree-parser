import { type NonNullAssert } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type Transformer } from '../transform.ts';

export const visitNonNullAssert = (
  node: NonNullAssert,
  transformer: Transformer,
): babel.TSNonNullExpression => ({
  type: 'TSNonNullExpression',
  expression: transformer.transformChild<babel.Expression>(node.expression),
});
