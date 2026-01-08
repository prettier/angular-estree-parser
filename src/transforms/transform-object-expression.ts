import type * as angular from '@angular/compiler';
import type * as babel from '@babel/types';

import { type Transformer } from '../transform-ast.ts';
import type { NGNode, RawNGSpan } from '../types.ts';

export const visitLiteralMap = (
  node: angular.LiteralMap,
  transformer: Transformer,
) => {
  const { keys, values } = node;
  const createChild = <T extends NGNode>(
    properties: Partial<T> & { type: T['type'] },
    location: angular.AST | RawNGSpan | [number, number] = node,
  ) =>
    transformer.create(properties, location, [node, ...transformer.ancestors]);

  return transformer.createNode<babel.ObjectExpression>({
    type: 'ObjectExpression',
    properties: keys.map((keyNode, index) => {
      const valueNode = values[index];
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
        [keyNode.sourceSpan.start, valueNode.sourceSpan.end],
      );
    }),
  });
};
