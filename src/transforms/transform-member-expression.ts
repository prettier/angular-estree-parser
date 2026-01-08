import {
  type KeyedRead,
  type PropertyRead,
  type SafeKeyedRead,
  type SafePropertyRead,
} from '@angular/compiler';
import type * as babel from '@babel/types';

import { type Transformer } from '../transform-ast.ts';
import { isOptionalObjectOrCallee } from './utilities.ts';

const keyedReadOptions = { computed: true, optional: false } as const;
const safeKeyedReadOptions = { computed: true, optional: true } as const;
const propertyReadOptions = { computed: false, optional: false } as const;
const safePropertyReadOptions = { computed: false, optional: true } as const;

type VisitorKeyedRead = {
  node: KeyedRead;
  options: typeof keyedReadOptions;
};
type VisitorSafeKeyedRead = {
  node: SafeKeyedRead;
  options: typeof safeKeyedReadOptions;
};
type VisitorPropertyRead = {
  node: PropertyRead;
  options: typeof propertyReadOptions;
};
type VisitorSafePropertyRead = {
  node: SafePropertyRead;
  options: typeof safePropertyReadOptions;
};

const transformMemberExpression =
  <
    Visitor extends
      | VisitorKeyedRead
      | VisitorSafeKeyedRead
      | VisitorPropertyRead
      | VisitorSafePropertyRead,
  >({
    computed,
    optional,
  }: Visitor['options']) =>
  (node: Visitor['node'], transformer: Transformer) => {
    const object = transformer.transformChild<babel.Expression>(node.receiver);

    let property;
    if (computed) {
      const { key } = node as KeyedRead | SafeKeyedRead;
      property = transformer.transformChild<babel.Expression>(key);
    } else {
      const { name, nameSpan } = node as PropertyRead | SafePropertyRead;
      property = transformer.createNode<babel.Identifier>(
        { type: 'Identifier', name: name },
        nameSpan,
        object ? [] : transformer.ancestors,
      );
    }

    if (!object) {
      return property;
    }

    const isOptionalObject = isOptionalObjectOrCallee(object);

    if (optional || isOptionalObject) {
      return transformer.createNode<babel.OptionalMemberExpression>({
        type: 'OptionalMemberExpression',
        optional: optional || !isOptionalObject,
        computed,
        property,
        object,
      });
    }

    if (computed) {
      return transformer.createNode<babel.MemberExpressionComputed>({
        type: 'MemberExpression',
        property,
        object,
        computed: true,
      });
    }

    return transformer.createNode<babel.MemberExpressionNonComputed>({
      type: 'MemberExpression',
      object,
      property: property as babel.MemberExpressionNonComputed['property'],
      computed: false,
    });
  };

export const visitKeyedRead =
  transformMemberExpression<VisitorKeyedRead>(keyedReadOptions);
export const visitSafeKeyedRead =
  transformMemberExpression<VisitorSafeKeyedRead>(safeKeyedReadOptions);
export const visitPropertyRead =
  transformMemberExpression<VisitorPropertyRead>(propertyReadOptions);
export const visitSafePropertyRead =
  transformMemberExpression<VisitorSafePropertyRead>(safePropertyReadOptions);
