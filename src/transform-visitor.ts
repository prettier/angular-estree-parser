import * as angular from '@angular/compiler';
import type * as babel from '@babel/types';

import { type Transformer } from './transform-ast.ts';
import type {
  NGChainedExpression,
  NGNode,
  NGPipeExpression,
  RawNGSpan,
} from './types.ts';

function isParenthesized(node: NGNode) {
  return Boolean(node.extra?.parenthesized);
}

function isOptionalObjectOrCallee(node: NGNode): boolean {
  if (node.type === 'TSNonNullExpression' && !isParenthesized(node)) {
    return isOptionalObjectOrCallee(node.expression);
  }

  return (
    (node.type === 'OptionalCallExpression' ||
      node.type === 'OptionalMemberExpression') &&
    !isParenthesized(node)
  );
}

type AstVisitor = Required<
  Omit<angular.AstVisitor, 'visit' | 'visitASTWithSource'>
>;

export const transformVisitor: AstVisitor = {
  visitUnary(node: angular.Unary, transformer: Transformer) {
    return transformer.createNode<babel.UnaryExpression>({
      type: 'UnaryExpression',
      prefix: true,
      argument: transformer.transformChild<babel.Expression>(node.expr),
      operator: node.operator as '-' | '+',
    });
  },

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

  visitPrefixNot(node: angular.PrefixNot, transformer: Transformer) {
    return transformer.createNode<babel.UnaryExpression>(
      {
        type: 'UnaryExpression',
        prefix: true,
        operator: '!',
        argument: transformer.transformChild<babel.Expression>(node.expression),
      },
      node.sourceSpan,
    );
  },

  visitTypeofExpression(
    node: angular.TypeofExpression,
    transformer: Transformer,
  ) {
    return transformer.createNode<babel.UnaryExpression>(
      {
        type: 'UnaryExpression',
        prefix: true,
        operator: 'typeof',
        argument: transformer.transformChild<babel.Expression>(node.expression),
      },
      node.sourceSpan,
    );
  },

  visitVoidExpression(
    node: angular.TypeofExpression,
    transformer: Transformer,
  ) {
    return transformer.createNode<babel.UnaryExpression>(
      {
        type: 'UnaryExpression',
        prefix: true,
        operator: 'void',
        argument: transformer.transformChild<babel.Expression>(node.expression),
      },
      node.sourceSpan,
    );
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

  visitKeyedRead(node: angular.KeyedRead, transformer: Transformer) {
    return transformMemberExpression(node, transformer, { computed: true });
  },

  visitSafeKeyedRead(node: angular.SafeKeyedRead, transformer: Transformer) {
    return transformMemberExpression(node, transformer, {
      computed: true,
      optional: true,
    });
  },

  visitPropertyRead(node: angular.PropertyRead, transformer: Transformer) {
    return transformMemberExpression(node, transformer);
  },

  visitSafePropertyRead(
    node: angular.SafePropertyRead,
    transformer: Transformer,
  ) {
    return transformMemberExpression(node, transformer, { optional: true });
  },

  visitCall(node: angular.Call, transformer: Transformer) {
    return transformCall(node, transformer);
  },

  visitSafeCall(node: angular.SafeCall, transformer: Transformer) {
    return transformCall(node, transformer, { optional: true });
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

function transformCall(
  node: angular.Call | angular.SafeCall,
  transformer: Transformer,
  { optional = false } = {},
) {
  const arguments_ = transformer.transformChildren<babel.Expression>(node.args);
  const callee = transformer.transformChild<babel.Expression>(node.receiver);
  const isOptionalReceiver = isOptionalObjectOrCallee(callee);
  const nodeType =
    optional || isOptionalReceiver
      ? 'OptionalCallExpression'
      : 'CallExpression';
  return transformer.createNode<
    babel.CallExpression | babel.OptionalCallExpression
  >({
    type: nodeType,
    callee,
    arguments: arguments_,
    ...(nodeType === 'OptionalCallExpression' ? { optional } : undefined),
  });
}

function transformMemberExpression(
  node:
    | angular.KeyedRead
    | angular.SafeKeyedRead
    | angular.PropertyRead
    | angular.SafePropertyRead,
  transformer: Transformer,
) {
  const { receiver } = node;
  const object = transformer.transformChild<babel.Expression>(receiver);
  const computed =
    node instanceof angular.KeyedRead || node instanceof angular.SafeKeyedRead;
  const optional =
    node instanceof angular.SafeKeyedRead ||
    node instanceof angular.SafePropertyRead;

  let property;
  if (computed) {
    property = transformer.transformChild<babel.Expression>(node.key);
  } else {
    property = transformer.createNode<babel.Identifier>(
      { type: 'Identifier', name: node.name },
      node.nameSpan,
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
}
