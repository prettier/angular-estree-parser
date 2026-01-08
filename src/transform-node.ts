import * as angular from '@angular/compiler';
import type * as babel from '@babel/types';

import { Source } from './source.ts';
import type {
  LocationInformation,
  NGChainedExpression,
  NGEmptyExpression,
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

type NodeTransformOptions = {
  ancestors: angular.AST[];
};

class Transformer extends Source {
  constructor(text: string) {
    super(text);
  }

  transform<T extends NGNode>(
    node: angular.AST,
    options?: NodeTransformOptions,
  ) {
    return this.#transform(node, options ?? { ancestors: [] }) as T &
      LocationInformation;
  }

  #create<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] },
    location: angular.AST | RawNGSpan | [number, number],
    ancestors: angular.AST[],
  ) {
    const node = super.createNode(properties, location);

    if (ancestors[0] instanceof angular.ParenthesizedExpression) {
      node.extra = {
        ...node.extra,
        parenthesized: true,
      };
    }

    return node;
  }

  #transform(node: angular.AST, options: NodeTransformOptions): NGNode {
    const ancestors = options.ancestors;
    const transformChild = <T extends NGNode>(child: angular.AST) =>
      this.transform<T>(child, { ancestors: [node, ...ancestors] });
    const transformChildren = <T extends NGNode>(children: angular.AST[]) =>
      children.map((child) => transformChild<T>(child));
    const createNode = <T extends NGNode>(
      properties: Partial<T> & { type: T['type'] },
      location: angular.AST | RawNGSpan | [number, number] = node,
      ancestorsToCreate: angular.AST[] = ancestors,
    ) => this.#create(properties, location, ancestorsToCreate);

    if (node instanceof angular.Interpolation) {
      const { expressions } = node;

      /* c8 ignore next 3 @preserve */
      if (expressions.length !== 1) {
        throw new Error("Unexpected 'Interpolation'");
      }

      return transformChild(expressions[0]);
    }

    if (node instanceof angular.Unary) {
      return createNode<babel.UnaryExpression>({
        type: 'UnaryExpression',
        prefix: true,
        argument: transformChild<babel.Expression>(node.expr),
        operator: node.operator as '-' | '+',
      });
    }

    if (node instanceof angular.Binary) {
      const { operation: operator } = node;
      const [left, right] = transformChildren<babel.Expression>([
        node.left,
        node.right,
      ]);

      if (operator === '&&' || operator === '||' || operator === '??') {
        return createNode<babel.LogicalExpression>({
          type: 'LogicalExpression',
          operator: operator as babel.LogicalExpression['operator'],
          left,
          right,
        });
      }

      if (angular.Binary.isAssignmentOperation(operator)) {
        return createNode<babel.AssignmentExpression>({
          type: 'AssignmentExpression',
          left: left as babel.MemberExpression,
          right,
          operator: operator as babel.AssignmentExpression['operator'],
        });
      }

      return createNode<babel.BinaryExpression>({
        left,
        right,
        type: 'BinaryExpression',
        operator: operator as babel.BinaryExpression['operator'],
      });
    }

    if (node instanceof angular.BindingPipe) {
      return createNode<NGPipeExpression>({
        type: 'NGPipeExpression',
        left: transformChild<babel.Expression>(node.exp),
        right: createNode<babel.Identifier>(
          { type: 'Identifier', name: node.name },
          node.nameSpan,
        ),
        arguments: transformChildren<babel.Expression>(node.args),
      });
    }

    if (node instanceof angular.Chain) {
      return createNode<NGChainedExpression>({
        type: 'NGChainedExpression',
        expressions: transformChildren<babel.Expression>(node.expressions),
      });
    }

    if (node instanceof angular.Conditional) {
      const [test, consequent, alternate] = transformChildren<babel.Expression>(
        [node.condition, node.trueExp, node.falseExp],
      );

      return createNode<babel.ConditionalExpression>({
        type: 'ConditionalExpression',
        test,
        consequent,
        alternate,
      });
    }

    if (node instanceof angular.EmptyExpr) {
      return createNode<NGEmptyExpression>({ type: 'NGEmptyExpression' });
    }

    if (node instanceof angular.ThisReceiver) {
      return createNode<babel.ThisExpression>({ type: 'ThisExpression' });
    }

    if (node instanceof angular.LiteralArray) {
      return createNode<babel.ArrayExpression>({
        type: 'ArrayExpression',
        elements: transformChildren<babel.Expression>(node.expressions),
      });
    }

    if (node instanceof angular.LiteralMap) {
      const { keys, values } = node;
      const createChild = <T extends NGNode>(
        properties: Partial<T> & { type: T['type'] },
        location: angular.AST | RawNGSpan | [number, number] = node,
      ) => this.#create(properties, location, [node, ...ancestors]);

      return createNode<babel.ObjectExpression>({
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
              value: transformChild<babel.Expression>(valueNode),
              shorthand,
              computed: false,
              // @ts-expect-error -- Missed in types
              method: false,
            },
            [keyNode.sourceSpan.start, valueNode.sourceSpan.end],
          );
        }),
      });
    }

    if (node instanceof angular.LiteralPrimitive) {
      const { value } = node;
      switch (typeof value) {
        case 'boolean':
          return createNode<babel.BooleanLiteral>({
            type: 'BooleanLiteral',
            value,
          });
        case 'number':
          return createNode<babel.NumericLiteral>({
            type: 'NumericLiteral',
            value,
          });
        case 'object':
          return createNode<babel.NullLiteral>({ type: 'NullLiteral' });
        case 'string':
          return createNode<babel.StringLiteral>({
            type: 'StringLiteral',
            value,
          });
        case 'undefined':
          return createNode<babel.Identifier>({
            type: 'Identifier',
            name: 'undefined',
          });
        /* c8 ignore next 4 */
        default:
          throw new Error(
            `Unexpected LiteralPrimitive value type ${typeof value}`,
          );
      }
    }

    if (node instanceof angular.RegularExpressionLiteral) {
      return createNode<babel.RegExpLiteral>({
        type: 'RegExpLiteral',
        pattern: node.body,
        flags: node.flags ?? '',
      });
    }

    if (node instanceof angular.Call || node instanceof angular.SafeCall) {
      const arguments_ = transformChildren<babel.Expression>(node.args);
      const callee = transformChild<babel.Expression>(node.receiver);
      const isOptionalReceiver = isOptionalObjectOrCallee(callee);
      const isOptional = node instanceof angular.SafeCall;
      const nodeType =
        isOptional || isOptionalReceiver
          ? 'OptionalCallExpression'
          : 'CallExpression';
      return createNode<babel.CallExpression | babel.OptionalCallExpression>({
        type: nodeType,
        callee,
        arguments: arguments_,
        ...(nodeType === 'OptionalCallExpression'
          ? { optional: isOptional }
          : undefined),
      });
    }

    if (node instanceof angular.NonNullAssert) {
      return createNode<babel.TSNonNullExpression>({
        type: 'TSNonNullExpression',
        expression: transformChild<babel.Expression>(node.expression),
      });
    }

    if (node instanceof angular.PrefixNot) {
      return createNode<babel.UnaryExpression>(
        {
          type: 'UnaryExpression',
          prefix: true,
          operator: '!',
          argument: transformChild<babel.Expression>(node.expression),
        },
        node.sourceSpan,
      );
    }

    if (node instanceof angular.TypeofExpression) {
      return createNode<babel.UnaryExpression>(
        {
          type: 'UnaryExpression',
          prefix: true,
          operator: 'typeof',
          argument: transformChild<babel.Expression>(node.expression),
        },
        node.sourceSpan,
      );
    }

    if (node instanceof angular.VoidExpression) {
      return createNode<babel.UnaryExpression>(
        {
          type: 'UnaryExpression',
          prefix: true,
          operator: 'void',
          argument: transformChild<babel.Expression>(node.expression),
        },
        node.sourceSpan,
      );
    }

    if (
      node instanceof angular.KeyedRead ||
      node instanceof angular.SafeKeyedRead ||
      node instanceof angular.PropertyRead ||
      node instanceof angular.SafePropertyRead
    ) {
      const isComputed =
        node instanceof angular.KeyedRead ||
        node instanceof angular.SafeKeyedRead;
      const isOptional =
        node instanceof angular.SafeKeyedRead ||
        node instanceof angular.SafePropertyRead;
      const { receiver } = node;
      const isImplicitReceiver = receiver instanceof angular.ImplicitReceiver;

      let property;
      if (isComputed) {
        property = transformChild<babel.Expression>(node.key);
      } else {
        property = createNode<babel.Identifier>(
          { type: 'Identifier', name: node.name },
          node.nameSpan,
          isImplicitReceiver ? ancestors : [],
        );
      }

      if (isImplicitReceiver) {
        return property;
      }

      const object = transformChild<babel.Expression>(receiver);
      const isOptionalObject = isOptionalObjectOrCallee(object);

      if (isOptional || isOptionalObject) {
        return createNode<babel.OptionalMemberExpression>({
          type: 'OptionalMemberExpression',
          optional: isOptional || !isOptionalObject,
          computed: isComputed,
          property,
          object,
        });
      }

      if (isComputed) {
        return createNode<babel.MemberExpressionComputed>({
          type: 'MemberExpression',
          property,
          object,
          computed: true,
        });
      }

      return createNode<babel.MemberExpressionNonComputed>({
        type: 'MemberExpression',
        object,
        property: property as babel.MemberExpressionNonComputed['property'],
        computed: false,
      });
    }

    if (node instanceof angular.TaggedTemplateLiteral) {
      return createNode<babel.TaggedTemplateExpression>({
        type: 'TaggedTemplateExpression',
        tag: transformChild<babel.Expression>(node.tag),
        quasi: transformChild<babel.TemplateLiteral>(node.template),
      });
    }

    if (node instanceof angular.TemplateLiteral) {
      return createNode<babel.TemplateLiteral>({
        type: 'TemplateLiteral',
        quasis: transformChildren(node.elements),
        expressions: transformChildren(node.expressions),
      });
    }

    if (node instanceof angular.TemplateLiteralElement) {
      const [parent] = ancestors;
      const { elements } = parent as angular.TemplateLiteral;
      const elementIndex = elements.indexOf(node);
      const isFirst = elementIndex === 0;
      const isLast = elementIndex === elements.length - 1;

      const end = node.sourceSpan.end - (isLast ? 1 : 0);
      const start = node.sourceSpan.start + (isFirst ? 1 : 0);
      const raw = this.text.slice(start, end);

      return createNode<babel.TemplateElement>(
        {
          type: 'TemplateElement',
          value: { cooked: node.text, raw },
          tail: isLast,
        },
        [start, end],
      );
    }

    if (node instanceof angular.ParenthesizedExpression) {
      return transformChild(node.expression);
    }

    /* c8 ignore next @preserve */
    throw new Error(`Unexpected node type '${node.constructor.name}'`);
  }
}

// See `convertAst` in `@angular/compiler`
type SupportedNodes =
  | angular.ASTWithSource // Not handled
  | angular.PropertyRead
  | angular.Call
  | angular.LiteralPrimitive
  | angular.Unary
  | angular.Binary
  | angular.ThisReceiver
  | angular.ImplicitReceiver
  | angular.KeyedRead
  | angular.Chain
  | angular.LiteralMap
  | angular.LiteralArray
  | angular.Conditional
  | angular.NonNullAssert
  | angular.BindingPipe
  | angular.SafeKeyedRead
  | angular.SafePropertyRead
  | angular.SafeCall
  | angular.EmptyExpr
  | angular.PrefixNot
  | angular.TypeofExpression
  | angular.VoidExpression
  | angular.TemplateLiteral // Including `TemplateLiteralElement`
  | angular.TaggedTemplateLiteral
  | angular.ParenthesizedExpression;
function transform(node: SupportedNodes, text: string): NGNode {
  return new Transformer(text).transform(node);
}

export { transform, Transformer };
