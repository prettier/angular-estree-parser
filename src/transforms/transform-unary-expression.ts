import {
  type PrefixNot,
  type TypeofExpression,
  type Unary,
  type VoidExpression,
} from '@angular/compiler';
import type * as babel from '@babel/types';

import { type Transformer } from '../transform-ast.ts';

type VisitorPrefixNot = {
  node: PrefixNot;
  operator: '!';
};
type VisitorTypeofExpression = {
  node: TypeofExpression;
  operator: 'typeof';
};
type VisitorVoidExpression = {
  node: VoidExpression;
  operator: 'void';
};

const transformUnaryExpression =
  <
    Visitor extends
      | VisitorPrefixNot
      | VisitorTypeofExpression
      | VisitorVoidExpression,
  >(
    operator: Visitor['operator'],
  ) =>
  (node: Visitor['node'], transformer: Transformer) =>
    transformer.createNode<babel.UnaryExpression>(
      {
        type: 'UnaryExpression',
        prefix: true,
        operator,
        argument: transformer.transformChild<babel.Expression>(node.expression),
      },
      node.sourceSpan,
    );

export const visitPrefixNot = transformUnaryExpression<VisitorPrefixNot>('!');
export const visitTypeofExpression =
  transformUnaryExpression<VisitorTypeofExpression>('typeof');
export const visitVoidExpression =
  transformUnaryExpression<VisitorVoidExpression>('void');
export const visitUnary = (node: Unary, transformer: Transformer) =>
  transformer.createNode<babel.UnaryExpression>({
    type: 'UnaryExpression',
    prefix: true,
    argument: transformer.transformChild<babel.Expression>(node.expr),
    operator: node.operator as '-' | '+',
  });
