import { type ParenthesizedExpression } from '@angular/compiler';

import { type Transformer } from '../transform-ast.ts';

export const visitParenthesizedExpression = (
  node: ParenthesizedExpression,
  transformer: Transformer,
) => transformer.transformChild(node.expression);
