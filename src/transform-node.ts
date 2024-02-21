import * as ng from '@angular/compiler';
import type * as b from '@babel/types';
import type Context from './context.js';
import type {
  NGChainedExpression,
  NGEmptyExpression,
  NGNode,
  NGPipeExpression,
  RawNGSpan,
} from './types.js';
import { createNode } from './utils.js';

function isParenthesized(node: NGNode) {
  return Boolean(node.extra?.parenthesized);
}
function getOuterStart(node: NGNode): number {
  return isParenthesized(node) ? node.extra.parenStart : node.start;
}
function getOuterEnd(node: NGNode): number {
  return isParenthesized(node) ? node.extra.parenEnd : node.end;
}

function isOptionalObjectOrCallee(node: NGNode): boolean {
  return (
    (node.type === 'OptionalCallExpression' ||
      node.type === 'OptionalMemberExpression') &&
    !isParenthesized(node)
  );
}

function isImplicitThis(node: ng.AST, text: string): boolean {
  const { start, end } = node.sourceSpan;
  return start >= end || /^\s+$/.test(text.slice(start, end));
}

function transform(
  node: ng.AST,
  context: Context,
  isInParentParens = false,
): NGNode {
  switch (true) {
    case node instanceof ng.Unary: {
      const { operator, expr } = node;
      const argumentNode = _t<b.Expression>(expr);
      return _c<b.UnaryExpression>(
        {
          type: 'UnaryExpression',
          prefix: true,
          argument: argumentNode,
          operator: operator as '-' | '+',
          ...node.sourceSpan,
        },
        { hasParentParens: isInParentParens },
      );
    }
    case node instanceof ng.Binary: {
      const {
        left: originalLeft,
        operation: operator,
        right: originalRight,
      } = node;
      const left = _t<b.Expression>(originalLeft);
      const right = _t<b.Expression>(originalRight);
      const start = getOuterStart(left);
      const end = getOuterEnd(right);
      const properties = {
        left,
        right,
        start,
        end,
      };

      if (operator === '&&' || operator === '||' || operator === '??') {
        return _c<b.LogicalExpression>(
          {
            ...properties,
            type: 'LogicalExpression',
            operator: operator as b.LogicalExpression['operator'],
          },
          { hasParentParens: isInParentParens },
        );
      }

      return _c<b.BinaryExpression>(
        {
          ...properties,
          type: 'BinaryExpression',
          operator: operator as b.BinaryExpression['operator'],
        },
        { hasParentParens: isInParentParens },
      );
    }
    case node instanceof ng.BindingPipe: {
      const { exp: expressionNode, name, args: originalArguments } = node;
      const left = _t<b.Expression>(expressionNode);
      const start = getOuterStart(left);
      const leftEnd = getOuterEnd(left);
      const rightStart = context.getCharacterIndex(
        /\S/,
        context.getCharacterIndex('|', leftEnd) + 1,
      );
      const right = _c<b.Identifier>({
        type: 'Identifier',
        name,
        start: rightStart,
        end: rightStart + name.length,
      });
      const argumentNodes = originalArguments.map<b.Expression>(_t);
      return _c<NGPipeExpression>(
        {
          type: 'NGPipeExpression',
          left,
          right,
          arguments: argumentNodes,
          start,
          end: getOuterEnd(
            // TODO[@fisker]: End seems not correct, since there should be `()`
            argumentNodes.length === 0 ? right : argumentNodes.at(-1)!,
          ),
        },
        { hasParentParens: isInParentParens },
      );
    }
    case node instanceof ng.Chain: {
      const { expressions } = node;
      return _c<NGChainedExpression>(
        {
          type: 'NGChainedExpression',
          expressions: expressions.map<b.Expression>(_t),
          ...node.sourceSpan,
        },
        { hasParentParens: isInParentParens },
      );
    }
    case node instanceof ng.Conditional: {
      const { condition, trueExp, falseExp } = node;
      const test = _t<b.Expression>(condition);
      const consequent = _t<b.Expression>(trueExp);
      const alternate = _t<b.Expression>(falseExp);
      return _c<b.ConditionalExpression>(
        {
          type: 'ConditionalExpression',
          test,
          consequent,
          alternate,
          start: getOuterStart(test),
          end: getOuterEnd(alternate),
        },
        { hasParentParens: isInParentParens },
      );
    }
    case node instanceof ng.EmptyExpr:
      return _c<NGEmptyExpression>(
        { type: 'NGEmptyExpression', ...node.sourceSpan },
        { hasParentParens: isInParentParens },
      );
    case node instanceof ng.ImplicitReceiver: {
      return _c<b.ThisExpression>(
        { type: 'ThisExpression', ...node.sourceSpan },
        { hasParentParens: isInParentParens },
      );
    }
    case node instanceof ng.KeyedRead:
    case node instanceof ng.SafeKeyedRead: {
      const isOptionalType = node instanceof ng.SafeKeyedRead;
      const { key, receiver } = node;
      const tKey = _t<b.Expression>(key);
      return _transformReceiverAndName(receiver, tKey, {
        computed: true,
        optional: isOptionalType,
        end: node.sourceSpan.end, // ]
        hasParentParens: isInParentParens,
      });
    }
    case node instanceof ng.LiteralArray: {
      const { expressions } = node;
      return _c<b.ArrayExpression>(
        {
          type: 'ArrayExpression',
          elements: expressions.map<b.Expression>(_t),
          ...node.sourceSpan,
        },
        { hasParentParens: isInParentParens },
      );
    }
    case node instanceof ng.LiteralMap: {
      const { keys, values } = node;
      const tValues = values.map((value) => _t<b.Expression>(value));
      const tProperties = keys.map(({ key, quoted }, index) => {
        const tValue = tValues[index];
        const valueStart = getOuterStart(tValue);
        const valueEnd = getOuterEnd(tValue);

        const keyStart = context.getCharacterIndex(
          /\S/,
          index === 0
            ? node.sourceSpan.start + 1 // {
            : context.getCharacterIndex(',', getOuterEnd(tValues[index - 1])) +
                1,
        );
        const keyEnd =
          valueStart === keyStart
            ? valueEnd
            : context.getCharacterLastIndex(
                /\S/,
                context.getCharacterLastIndex(':', valueStart - 1) - 1,
              ) + 1;
        const keySpan = { start: keyStart, end: keyEnd };
        const tKey = quoted
          ? _c<b.StringLiteral>({
              type: 'StringLiteral',
              value: key,
              ...keySpan,
            })
          : _c<b.Identifier>({ type: 'Identifier', name: key, ...keySpan });
        const shorthand = tKey.end < tKey.start || keyStart === valueStart;

        return _c<b.ObjectProperty>({
          type: 'ObjectProperty',
          key: tKey,
          value: tValue,
          shorthand,
          computed: false,
          start: getOuterStart(tKey),
          end: valueEnd,
        });
      });
      return _c<b.ObjectExpression>(
        {
          type: 'ObjectExpression',
          properties: tProperties,
          ...node.sourceSpan,
        },
        { hasParentParens: isInParentParens },
      );
    }
    case node instanceof ng.LiteralPrimitive: {
      const { value } = node;
      switch (typeof value) {
        case 'boolean':
          return _c<b.BooleanLiteral>(
            { type: 'BooleanLiteral', value, ...node.sourceSpan },
            { hasParentParens: isInParentParens },
          );
        case 'number':
          return _c<b.NumericLiteral>(
            { type: 'NumericLiteral', value, ...node.sourceSpan },
            { hasParentParens: isInParentParens },
          );
        case 'object':
          return _c<b.NullLiteral>(
            { type: 'NullLiteral', ...node.sourceSpan },
            { hasParentParens: isInParentParens },
          );
        case 'string':
          return _c<b.StringLiteral>(
            { type: 'StringLiteral', value, ...node.sourceSpan },
            { hasParentParens: isInParentParens },
          );
        case 'undefined':
          return _c<b.Identifier>(
            { type: 'Identifier', name: 'undefined', ...node.sourceSpan },
            { hasParentParens: isInParentParens },
          );
        // istanbul ignore next
        default:
          throw new Error(
            `Unexpected LiteralPrimitive value type ${typeof value}`,
          );
      }
    }
    case node instanceof ng.Call:
    case node instanceof ng.SafeCall: {
      const isOptionalType = node instanceof ng.SafeCall;
      const { receiver, args } = node;
      const tArgs =
        args.length === 1
          ? [_transformHasParentParens<b.Expression>(args[0])]
          : (args as ng.AST[]).map<b.Expression>(_t);
      const tReceiver = _t<b.Expression>(receiver!);
      const isOptionalReceiver = isOptionalObjectOrCallee(tReceiver);
      const nodeType =
        isOptionalType || isOptionalReceiver
          ? 'OptionalCallExpression'
          : 'CallExpression';
      return _c<b.CallExpression | b.OptionalCallExpression>(
        {
          type: nodeType,
          callee: tReceiver,
          arguments: tArgs,
          optional:
            nodeType === 'OptionalCallExpression' ? isOptionalType : undefined,
          start: getOuterStart(tReceiver),
          end: node.sourceSpan.end, // )
        },
        { hasParentParens: isInParentParens },
      );
    }
    case node instanceof ng.NonNullAssert: {
      const { expression } = node;
      const tExpression = _t<b.Expression>(expression);
      return _c<b.TSNonNullExpression>(
        {
          type: 'TSNonNullExpression',
          expression: tExpression,
          start: getOuterStart(tExpression),
          end: node.sourceSpan.end, // !
        },
        { hasParentParens: isInParentParens },
      );
    }
    case node instanceof ng.PrefixNot: {
      const { expression } = node;
      const tExpression = _t<b.Expression>(expression);
      return _c<b.UnaryExpression>(
        {
          type: 'UnaryExpression',
          prefix: true,
          operator: '!',
          argument: tExpression,
          start: node.sourceSpan.start, // !
          end: getOuterEnd(tExpression),
        },
        { hasParentParens: isInParentParens },
      );
    }
    case node instanceof ng.PropertyRead:
    case node instanceof ng.SafePropertyRead: {
      const isOptionalType = node instanceof ng.SafePropertyRead;
      const { receiver, name } = node;
      const nameEnd =
        context.getCharacterLastIndex(/\S/, node.sourceSpan.end - 1) + 1;
      const tName = _c<b.Identifier>(
        {
          type: 'Identifier',
          name,
          start: nameEnd - name.length,
          end: nameEnd,
        },
        isImplicitThis(receiver, context.text)
          ? { hasParentParens: isInParentParens }
          : {},
      );
      return _transformReceiverAndName(receiver, tName, {
        computed: false,
        optional: isOptionalType,
        hasParentParens: isInParentParens,
      });
    }
    case node instanceof ng.KeyedWrite: {
      const { key, value, receiver } = node;
      const tKey = _t<b.Expression>(key);
      const right = _t<b.Expression>(value);
      const left = _transformReceiverAndName(receiver, tKey, {
        computed: true,
        optional: false,
        end: context.getCharacterIndex(']', getOuterEnd(tKey)) + 1,
      });
      return _c<b.AssignmentExpression>(
        {
          type: 'AssignmentExpression',
          left: left as b.MemberExpression,
          operator: '=',
          right,
          start: getOuterStart(left),
          end: getOuterEnd(right),
        },
        { hasParentParens: isInParentParens },
      );
    }
    case node instanceof ng.PropertyWrite: {
      const { receiver, name, value } = node;
      const tValue = _t<b.Expression>(value);
      const nameEnd =
        context.getCharacterLastIndex(
          /\S/,
          context.getCharacterLastIndex('=', getOuterStart(tValue) - 1) - 1,
        ) + 1;
      const tName = _c<b.Identifier>({
        type: 'Identifier',
        name,
        start: nameEnd - name.length,
        end: nameEnd,
      });
      const tReceiverAndName = _transformReceiverAndName(receiver, tName, {
        computed: false,
        optional: false,
      });
      return _c<b.AssignmentExpression>(
        {
          type: 'AssignmentExpression',
          left: tReceiverAndName as b.MemberExpression,
          operator: '=',
          right: tValue,
          start: getOuterStart(tReceiverAndName),
          end: getOuterEnd(tValue),
        },
        { hasParentParens: isInParentParens },
      );
    }
    // istanbul ignore next
    default:
      throw Object.assign(new Error(`Unexpected node`), { node });
  }

  function _t<T extends NGNode>(n: ng.AST) {
    return transform(n, context) as T;
  }
  function _transformHasParentParens<T extends NGNode>(n: ng.AST) {
    return transform(n, context, true) as T;
  }

  function _c<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] } & RawNGSpan,
    { stripSpaces = true, hasParentParens = false } = {},
  ) {
    return createNode<T>(context, properties, { stripSpaces, hasParentParens });
  }

  function _transformReceiverAndName(
    receiver: ng.AST,
    property: b.Expression,
    {
      computed,
      optional,
      end = getOuterEnd(property),
      hasParentParens = false,
    }: {
      computed: boolean;
      optional: boolean;
      end?: number;
      hasParentParens?: boolean;
    },
  ) {
    if (
      isImplicitThis(receiver, context.text) ||
      receiver.sourceSpan.start === property.start
    ) {
      return property;
    }
    const object = _t<b.Expression>(receiver);
    const isOptionalObject = isOptionalObjectOrCallee(object);
    return _c<b.OptionalMemberExpression | b.MemberExpression>(
      {
        type:
          optional || isOptionalObject
            ? 'OptionalMemberExpression'
            : 'MemberExpression',
        object,
        property,
        computed: computed,
        ...(optional
          ? { optional: true }
          : isOptionalObject
            ? { optional: false }
            : undefined),
        start: getOuterStart(object),
        end,
      },
      { hasParentParens },
    );
  }
}

export default transform;
