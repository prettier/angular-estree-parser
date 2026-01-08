import { Binary } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type Transformer } from './transform.ts';

const isAssignmentOperator = (
  operator: Binary['operation'],
): operator is babel.AssignmentExpression['operator'] =>
  Binary.isAssignmentOperation(operator);

const isLogicalOperator = (
  operator: Binary['operation'],
): operator is babel.LogicalExpression['operator'] =>
  operator === '&&' || operator === '||' || operator === '??';

export const visitBinary = (
  node: Binary,
  transformer: Transformer,
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

  if (isAssignmentOperator(operator)) {
    return {
      type: 'AssignmentExpression',
      left: left as babel.MemberExpression,
      right,
      operator: operator,
    };
  }

  return {
    left,
    right,
    type: 'BinaryExpression',
    operator: operator as babel.BinaryExpression['operator'],
  };
};
