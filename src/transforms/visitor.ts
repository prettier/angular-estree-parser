import type * as angular from '@angular/compiler';
import type * as babel from '@babel/types';

import { type Transformer } from '../transform-ast.ts';
import type { NGChainedExpression, NGPipeExpression } from '../types.ts';
import { visitBinary } from './transform-binary-expression.ts';
import { visitCall, visitSafeCall } from './transform-call-expression.ts';
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
  visitTaggedTemplateLiteral,
  visitTemplateLiteral,
  visitTemplateLiteralElement,
} from './transform-template-literal.ts';
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

  visitBinary,

  visitLiteralMap,

  visitLiteralPrimitive,
  visitRegularExpressionLiteral,

  visitTaggedTemplateLiteral,
  visitTemplateLiteral,
  visitTemplateLiteralElement,

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
