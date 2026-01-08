import {
  type LiteralPrimitive,
  type RegularExpressionLiteral,
} from '@angular/compiler';
import type * as babel from '@babel/types';

import { type Transformer } from '../transform-ast.ts';

export const visitLiteralPrimitive = (
  node: LiteralPrimitive,
  transformer: Transformer,
) => {
  const { value } = node;
  switch (typeof value) {
    case 'boolean':
      return transformer.createNode<babel.BooleanLiteral>({
        type: 'BooleanLiteral',
        value,
      });
    case 'number':
      return transformer.createNode<babel.NumericLiteral>({
        type: 'NumericLiteral',
        value,
      });
    case 'object':
      return transformer.createNode<babel.NullLiteral>({
        type: 'NullLiteral',
      });
    case 'string':
      return transformer.createNode<babel.StringLiteral>({
        type: 'StringLiteral',
        value,
      });
    case 'undefined':
      return transformer.createNode<babel.Identifier>({
        type: 'Identifier',
        name: 'undefined',
      });
    /* c8 ignore next 4 */
    default:
      throw new Error(
        `Unexpected 'LiteralPrimitive' value type ${typeof value}`,
      );
  }
};

export const visitRegularExpressionLiteral = (
  node: RegularExpressionLiteral,
  transformer: Transformer,
) =>
  transformer.createNode<babel.RegExpLiteral>({
    type: 'RegExpLiteral',
    pattern: node.body,
    flags: node.flags ?? '',
  });
