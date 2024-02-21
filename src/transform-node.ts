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

// See `convertAst` in `@angular/compiler`
// ASTWithSource (Not handled)
// PropertyRead
// PropertyWrite
// KeyedWrite
// Call
// LiteralPrimitive
// Unary
// Binary
// ThisReceiver
// KeyedRead
// Chain
// LiteralMap
// LiteralArray
// Conditional
// NonNullAssert
// BindingPipe
// SafeKeyedRead
// SafePropertyRead
// SafeCall
// EmptyExpr
// PrefixNot
function transform(
  node: ng.AST,
  context: Context,
  isInParentParens = false,
): NGNode {
  if (node instanceof ng.Unary) {
    return _c<b.UnaryExpression>(
      {
        type: 'UnaryExpression',
        prefix: true,
        argument: _t<b.Expression>(node.expr),
        operator: node.operator as '-' | '+',
        ...node.sourceSpan,
      },
      { hasParentParens: isInParentParens },
    );
  }

  if (node instanceof ng.Binary) {
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

  if (node instanceof ng.BindingPipe) {
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

  if (node instanceof ng.Chain) {
    return _c<NGChainedExpression>(
      {
        type: 'NGChainedExpression',
        expressions: node.expressions.map<b.Expression>(_t),
        ...node.sourceSpan,
      },
      { hasParentParens: isInParentParens },
    );
  }

  if (node instanceof ng.Conditional) {
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

  if (node instanceof ng.EmptyExpr) {
    return _c<NGEmptyExpression>(
      { type: 'NGEmptyExpression', ...node.sourceSpan },
      { hasParentParens: isInParentParens },
    );
  }

  if (node instanceof ng.ImplicitReceiver) {
    return _c<b.ThisExpression>(
      { type: 'ThisExpression', ...node.sourceSpan },
      { hasParentParens: isInParentParens },
    );
  }

  if (node instanceof ng.KeyedRead || node instanceof ng.SafeKeyedRead) {
    return _transformReceiverAndName(
      node.receiver,
      _t<b.Expression>(node.key),
      {
        computed: true,
        optional: node instanceof ng.SafeKeyedRead,
        end: node.sourceSpan.end, // ]
        hasParentParens: isInParentParens,
      },
    );
  }

  if (node instanceof ng.LiteralArray) {
    return _c<b.ArrayExpression>(
      {
        type: 'ArrayExpression',
        elements: node.expressions.map<b.Expression>(_t),
        ...node.sourceSpan,
      },
      { hasParentParens: isInParentParens },
    );
  }

  if (node instanceof ng.LiteralMap) {
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
          : context.getCharacterIndex(',', getOuterEnd(tValues[index - 1])) + 1,
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

  if (node instanceof ng.LiteralPrimitive) {
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

  if (node instanceof ng.Call || node instanceof ng.SafeCall) {
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

  if (node instanceof ng.NonNullAssert) {
    const expression = _t<b.Expression>(node.expression);
    return _c<b.TSNonNullExpression>(
      {
        type: 'TSNonNullExpression',
        expression: expression,
        start: getOuterStart(expression),
        end: node.sourceSpan.end, // !
      },
      { hasParentParens: isInParentParens },
    );
  }

  if (node instanceof ng.PrefixNot) {
    const expression = _t<b.Expression>(node.expression);
    return _c<b.UnaryExpression>(
      {
        type: 'UnaryExpression',
        prefix: true,
        operator: '!',
        argument: expression,
        start: node.sourceSpan.start, // !
        end: getOuterEnd(expression),
      },
      { hasParentParens: isInParentParens },
    );
  }

  if (node instanceof ng.PropertyRead || node instanceof ng.SafePropertyRead) {
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
      optional: node instanceof ng.SafePropertyRead,
      hasParentParens: isInParentParens,
    });
  }

  if (node instanceof ng.KeyedWrite) {
    const key = _t<b.Expression>(node.key);
    const right = _t<b.Expression>(node.value);
    const left = _transformReceiverAndName(node.receiver, key, {
      computed: true,
      optional: false,
      end: context.getCharacterIndex(']', getOuterEnd(key)) + 1,
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

  if (node instanceof ng.PropertyWrite) {
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
  throw Object.assign(new Error('Unexpected node'), { node });

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
