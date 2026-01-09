import { type ParenthesizedExpression } from '@angular/compiler';

import { type NodeTransformer } from '../ast-transform/node-transformer.ts';

export const visitParenthesizedExpression = (
  node: ParenthesizedExpression,
  transformer: NodeTransformer,
) => transformer.transformChild(node.expression);
