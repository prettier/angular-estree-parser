import * as angular from '@angular/compiler';
import type * as babel from '@babel/types';

import { type Transformer } from '../transform-ast.ts';
import type { NGChainedExpression, NGPipeExpression } from '../types.ts';
import { visitCall, visitSafeCall } from './transform-call.ts';
import {
  visitLiteralPrimitive,
  visitRegularExpressionLiteral,
} from './transform-literal.ts';
import {
  visitKeyedRead,
  visitPropertyRead,
  visitSafeKeyedRead,
  visitSafePropertyRead,
} from './transform-member-expression.ts';
import { visitLiteralMap } from './transform-object-expression.ts';
import {
  visitPrefixNot,
  visitTypeofExpression,
  visitUnary,
  visitVoidExpression,
} from './transform-unary-expression.ts';

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

  visitLiteralMap,

  visitLiteralPrimitive,
  visitRegularExpressionLiteral,

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
