import { Binary } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type NodeTransformer } from '../node-transformer.ts';

const isLogicalOperator = (
  operator: Binary['operation'],
): operator is babel.LogicalExpression['operator'] =>
  operator === '&&' || operator === '||' || operator === '??';

export const visitBinary = (
  node: Binary,
  transformer: NodeTransformer,
):
  | babel.LogicalExpression
  | babel.AssignmentExpression
  | babel.BinaryExpression => {
  const { operation: operator } = node;
  const [left, right] = transformer.transformChildren<babel.Expression>([
    node.left,
    node.right,
  ]);

  if (isLogicalOperator(operator)) {
    return { type: 'LogicalExpression', operator, left, right };
  }

  if (Binary.isAssignmentOperation(operator)) {
    return {
      type: 'AssignmentExpression',
      left: left as babel.AssignmentExpression['left'],
      right,
      operator: operator,
    };
  }

  return { left, right, type: 'BinaryExpression', operator: operator };
};
