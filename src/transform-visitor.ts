import * as angular from '@angular/compiler';
import type * as babel from '@babel/types';

import { type Transformer } from './transform-ast.ts';
import { visitCall, visitSafeCall } from './transforms/transform-call.ts';
import {
  visitKeyedRead,
  visitPropertyRead,
  visitSafeKeyedRead,
  visitSafePropertyRead,
} from './transforms/transform-member-expression.ts';
import {
  visitPrefixNot,
  visitTypeofExpression,
  visitUnary,
  visitVoidExpression,
} from './transforms/transform-unary-expression.ts';
import type {
  NGChainedExpression,
  NGNode,
  NGPipeExpression,
  RawNGSpan,
} from './types.ts';

type AstVisitor = Required<
  Omit<angular.AstVisitor, 'visit' | 'visitASTWithSource'>
>;

export const transformVisitor: AstVisitor = {
  visitCall,
  visitSafeCall,

  visitKeyedRead,
  visitPropertyRead,
  visitSafeKeyedRead,
  visitSafePropertyRead,

  visitPrefixNot,
  visitTypeofExpression,
  visitVoidExpression,
  visitUnary,

  visitBinary(node: angular.Binary, transformer: Transformer) {
    const { operation: operator } = node;
    const [left, right] = transformer.transformChildren<babel.Expression>([
      node.left,
      node.right,
    ]);

    if (operator === '&&' || operator === '||' || operator === '??') {
      return transformer.createNode<babel.LogicalExpression>({
        type: 'LogicalExpression',
        operator: operator as babel.LogicalExpression['operator'],
        left,
        right,
      });
    }

    if (angular.Binary.isAssignmentOperation(operator)) {
      return transformer.createNode<babel.AssignmentExpression>({
        type: 'AssignmentExpression',
        left: left as babel.MemberExpression,
        right,
        operator: operator as babel.AssignmentExpression['operator'],
      });
    }

    return transformer.createNode<babel.BinaryExpression>({
      left,
      right,
      type: 'BinaryExpression',
      operator: operator as babel.BinaryExpression['operator'],
    });
  },

  visitPipe(node: angular.BindingPipe, transformer: Transformer) {
    return transformer.createNode<NGPipeExpression>({
      type: 'NGPipeExpression',
      left: transformer.transformChild<babel.Expression>(node.exp),
      right: transformer.createNode<babel.Identifier>(
        { type: 'Identifier', name: node.name },
        node.nameSpan,
      ),
      arguments: transformer.transformChildren<babel.Expression>(node.args),
    });
  },

  visitChain(node: angular.Chain, transformer: Transformer) {
    return transformer.createNode<NGChainedExpression>({
      type: 'NGChainedExpression',
      expressions: transformer.transformChildren<babel.Expression>(
        node.expressions,
      ),
    });
  },

  visitConditional(node: angular.Conditional, transformer: Transformer) {
    const [test, consequent, alternate] =
      transformer.transformChildren<babel.Expression>([
        node.condition,
        node.trueExp,
        node.falseExp,
      ]);

    return transformer.createNode<babel.ConditionalExpression>({
      type: 'ConditionalExpression',
      test,
      consequent,
      alternate,
    });
  },

  visitThisReceiver(node: angular.ThisReceiver, transformer: Transformer) {
    return transformer.createNode<babel.ThisExpression>({
      type: 'ThisExpression',
    });
  },

  visitLiteralArray(node: angular.LiteralArray, transformer: Transformer) {
    return transformer.createNode<babel.ArrayExpression>({
      type: 'ArrayExpression',
      elements: transformer.transformChildren<babel.Expression>(
        node.expressions,
      ),
    });
  },

  visitLiteralMap(node: angular.LiteralMap, transformer: Transformer) {
    const { keys, values } = node;
    const createChild = <T extends NGNode>(
      properties: Partial<T> & { type: T['type'] },
      location: angular.AST | RawNGSpan | [number, number] = node,
    ) =>
      transformer.create(properties, location, [
        node,
        ...transformer.ancestors,
      ]);

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
  },

  visitLiteralPrimitive(
    node: angular.LiteralPrimitive,
    transformer: Transformer,
  ) {
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
          `Unexpected LiteralPrimitive value type ${typeof value}`,
        );
    }
  },

  visitRegularExpressionLiteral(
    node: angular.RegularExpressionLiteral,
    transformer: Transformer,
  ) {
    return transformer.createNode<babel.RegExpLiteral>({
      type: 'RegExpLiteral',
      pattern: node.body,
      flags: node.flags ?? '',
    });
  },

  visitNonNullAssert(node: angular.NonNullAssert, transformer: Transformer) {
    return transformer.createNode<babel.TSNonNullExpression>({
      type: 'TSNonNullExpression',
      expression: transformer.transformChild<babel.Expression>(node.expression),
    });
  },

  visitTaggedTemplateLiteral(
    node: angular.TaggedTemplateLiteral,
    transformer: Transformer,
  ) {
    return transformer.createNode<babel.TaggedTemplateExpression>({
      type: 'TaggedTemplateExpression',
      tag: transformer.transformChild<babel.Expression>(node.tag),
      quasi: transformer.transformChild<babel.TemplateLiteral>(node.template),
    });
  },

  visitTemplateLiteral(
    node: angular.TemplateLiteral,
    transformer: Transformer,
  ) {
    return transformer.createNode<babel.TemplateLiteral>({
      type: 'TemplateLiteral',
      quasis: transformer.transformChildren(node.elements),
      expressions: transformer.transformChildren(node.expressions),
    });
  },

  visitTemplateLiteralElement(
    node: angular.TemplateLiteralElement,
    transformer: Transformer,
  ) {
    const [parent] = transformer.ancestors;
    const { elements } = parent as angular.TemplateLiteral;
    const elementIndex = elements.indexOf(node);
    const isFirst = elementIndex === 0;
    const isLast = elementIndex === elements.length - 1;

    const end = node.sourceSpan.end - (isLast ? 1 : 0);
    const start = node.sourceSpan.start + (isFirst ? 1 : 0);
    const raw = transformer.text.slice(start, end);

    return transformer.createNode<babel.TemplateElement>(
      {
        type: 'TemplateElement',
        value: { cooked: node.text, raw },
        tail: isLast,
      },
      [start, end],
    );
  },

  visitParenthesizedExpression(
    node: angular.ParenthesizedExpression,
    transformer: Transformer,
  ) {
    return transformer.transformChild(node.expression);
  },

  visitInterpolation(node: angular.Interpolation, transformer: Transformer) {
    const { expressions } = node;

    /* c8 ignore next 3 @preserve */
    if (expressions.length !== 1) {
      throw new Error("Unexpected 'Interpolation'");
    }

    return transformer.transformChild(expressions[0]);
  },

  visitImplicitReceiver() {},
};
