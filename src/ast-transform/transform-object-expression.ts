import type * as angular from '@angular/compiler';
import type * as babel from '@babel/types';

import type { NGNode, RawNGSpan } from '../types.ts';
import { type Transformer } from './transform.ts';

export const visitLiteralMap = (
  node: angular.LiteralMap,
  transformer: Transformer,
): babel.ObjectExpression => {
  const { keys, values } = node;
  const createChild = <T extends NGNode>(
    properties: Partial<T> & { type: T['type'] },
    location: angular.AST | RawNGSpan | [number, number] = node,
  ) =>
    transformer.create(properties, location, [node, ...transformer.ancestors]);

  return {
    type: 'ObjectExpression',
    properties: keys.map((keyNode, index) => {
      const valueNode = values[index];
      const range: [number, number] = [
        keyNode.sourceSpan.start,
        valueNode.sourceSpan.end,
      ];

      if (keyNode.kind === 'spread') {
        return createChild<babel.SpreadElement>(
          {
            type: 'SpreadElement',
            argument: transformer.transformChild<babel.Expression>(valueNode),
          },
          range,
        );
      }

      const shorthand = Boolean(keyNode.isShorthandInitialized);
      const key = createChild<babel.Identifier | babel.StringLiteral>(
        keyNode.quoted
          ? { type: 'StringLiteral', value: keyNode.key }
          : { type: 'Identifier', name: keyNode.key },
        keyNode.sourceSpan,
      );

      return createChild<babel.ObjectPropertyNonComputed>(
        {
          type: 'ObjectProperty',
          key,
          value: transformer.transformChild<babel.Expression>(valueNode),
          shorthand,
          computed: false,
          // @ts-expect-error -- Missed in types
          method: false,
        },
        range,
      );
    }),
  };
};
