import { type Conditional } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type Transformer } from '../transform-ast.ts';

export const visitConditional = (
  node: Conditional,
  transformer: Transformer,
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
