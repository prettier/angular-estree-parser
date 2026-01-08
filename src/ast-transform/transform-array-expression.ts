import { type LiteralArray } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type Transformer } from '../transform-ast.ts';

export const visitLiteralArray = (
  node: LiteralArray,
  transformer: Transformer,
): babel.ArrayExpression => ({
  type: 'ArrayExpression',
  elements: transformer.transformChildren<babel.Expression>(node.expressions),
});
