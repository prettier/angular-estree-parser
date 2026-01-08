import {
  type LiteralPrimitive,
  type RegularExpressionLiteral,
} from '@angular/compiler';
import type * as babel from '@babel/types';

export const visitLiteralPrimitive = (
  node: LiteralPrimitive,
):
  | babel.BooleanLiteral
  | babel.NumericLiteral
  | babel.NullLiteral
  | babel.StringLiteral
  | babel.Identifier => {
  const { value } = node;
  switch (typeof value) {
    case 'boolean':
      return { type: 'BooleanLiteral', value };
    case 'number':
      return { type: 'NumericLiteral', value };
    case 'object':
      return { type: 'NullLiteral' };
    case 'string':
      return { type: 'StringLiteral', value };
    case 'undefined':
      return { type: 'Identifier', name: 'undefined' };
    /* c8 ignore next 4 */
    default:
      throw new Error(
        `Unexpected 'LiteralPrimitive' value type ${typeof value}`,
      );
  }
};

export const visitRegularExpressionLiteral = (
  node: RegularExpressionLiteral,
): babel.RegExpLiteral => ({
  type: 'RegExpLiteral',
  pattern: node.body,
  flags: node.flags ?? '',
});
