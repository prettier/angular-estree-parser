import { type ParenthesizedExpression } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type NodeTransformer } from '../node-transformer.ts';

export const visitParenthesizedExpression = (
  node: ParenthesizedExpression,
  transformer: NodeTransformer,
) => transformer.transformChild<babel.Expression>(node.expression);
