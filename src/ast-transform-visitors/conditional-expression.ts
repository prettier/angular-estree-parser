import { type Conditional } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type NodeTransformer } from '../ast-transform/node-transformer.ts';

export const visitConditional = (
  node: Conditional,
  transformer: NodeTransformer,
): babel.ConditionalExpression => {
  const [test, consequent, alternate] =
    transformer.transformChildren<babel.Expression>([
      node.condition,
      node.trueExp,
      node.falseExp,
    ]);

  return {
    type: 'ConditionalExpression',
    test,
    consequent,
    alternate,
  };
};
