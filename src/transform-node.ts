import * as ng from '@angular/compiler';
import type * as b from '@babel/types';
import type Context from './context.js';
import type {
  LocationInformation,
  NGChainedExpression,
  NGEmptyExpression,
  NGNode,
  NGPipeExpression,
  RawNGSpan,
} from './types.js';
import { transformSpan, getNgType } from './utils.js';

function createNode<T extends NGNode>(
  context: Context,
  type: T['type'],
  properties: Partial<T>,
  span: RawNGSpan,
  { processSpan = true, hasParentParens = false } = {},
) {
  const node = {
    type,
    ...transformSpan(span, context.text, { processSpan, hasParentParens }),
    ...properties,
  } as T & LocationInformation;
  switch (type) {
    case 'NumericLiteral':
    case 'StringLiteral': {
      const raw = context.text.slice(node.start, node.end);
      const { value } = node as unknown as b.NumericLiteral | b.StringLiteral;
      node.extra = { ...node.extra, raw, rawValue: value };
      break;
    }
    case 'ObjectProperty': {
      const { shorthand } = node as unknown as b.ObjectProperty;
      if (shorthand) {
        node.extra = { ...node.extra, shorthand };
      }
      break;
    }
  }

  return node;
}

function isParenthesized(node: NGNode) {
  return Boolean(node.extra?.parenthesized);
}
function getOuterStart(node: NGNode): number {
  return isParenthesized(node) ? node.extra.parenStart : node.start;
}
function getOuterEnd(node: NGNode): number {
  return isParenthesized(node) ? node.extra.parenEnd : node.end;
}

function transform(
  node: ng.AST,
  context: Context,
  isInParentParens = false,
): NGNode {
  const type = getNgType(node);
  switch (type) {
    case 'Unary': {
      const { operator, expr } = node as ng.Unary;
      const tArgument = _t<b.Expression>(expr);
      return _c<b.UnaryExpression>(
        'UnaryExpression',
        {
          prefix: true,
          argument: tArgument,
          operator: operator as '-' | '+',
        },
        node.sourceSpan,
        { hasParentParens: isInParentParens },
      );
    }
    case 'Binary': {
      const { left, operation, right } = node as ng.Binary;
      const tLeft = _t<b.Expression>(left);
      const tRight = _t<b.Expression>(right);
      return _c<b.LogicalExpression | b.BinaryExpression>(
        operation === '&&' || operation === '||' || operation === '??'
          ? 'LogicalExpression'
          : 'BinaryExpression',
        {
          left: tLeft,
          right: tRight,
          // @ts-expect-error `operation` is operator for LogicalExpression or BinaryExpression
          operator: operation,
        },
        { start: getOuterStart(tLeft), end: getOuterEnd(tRight) },
        { hasParentParens: isInParentParens },
      );
    }
    case 'BindingPipe': {
      const { exp, name, args } = node as ng.BindingPipe;
      const tExp = _t<b.Expression>(exp);
      const nameStart = context.getCharacterIndex(
        /\S/,
        context.getCharacterIndex('|', getOuterEnd(tExp)) + 1,
      );
      const tName = _c<b.Identifier>(
        'Identifier',
        { name },
        { start: nameStart, end: nameStart + name.length },
      );
      const tArgs = args.map<b.Expression>(_t);
      return _c<NGPipeExpression>(
        'NGPipeExpression',
        {
          left: tExp,
          right: tName,
          arguments: tArgs,
        },
        {
          start: getOuterStart(tExp),
          end: getOuterEnd(tArgs.length === 0 ? tName : tArgs.at(-1)!),
        },
        { hasParentParens: isInParentParens },
      );
    }
    case 'Chain': {
      const { expressions } = node as ng.Chain;
      return _c<NGChainedExpression>(
        'NGChainedExpression',
        { expressions: expressions.map<b.Expression>(_t) },
        node.sourceSpan,
        { hasParentParens: isInParentParens },
      );
    }
    case 'Conditional': {
      const { condition, trueExp, falseExp } = node as ng.Conditional;
      const tCondition = _t<b.Expression>(condition);
      const tTrueExp = _t<b.Expression>(trueExp);
      const tFalseExp = _t<b.Expression>(falseExp);
      return _c<b.ConditionalExpression>(
        'ConditionalExpression',
        {
          test: tCondition,
          consequent: tTrueExp,
          alternate: tFalseExp,
        },
        { start: getOuterStart(tCondition), end: getOuterEnd(tFalseExp) },
        { hasParentParens: isInParentParens },
      );
    }
    case 'EmptyExpr':
      return _c<NGEmptyExpression>('NGEmptyExpression', {}, node.sourceSpan, {
        hasParentParens: isInParentParens,
      });
    case 'ImplicitReceiver': {
      return _c<b.ThisExpression>('ThisExpression', {}, node.sourceSpan, {
        hasParentParens: isInParentParens,
      });
    }
    case 'KeyedRead':
    case 'SafeKeyedRead': {
      const isOptionalType = type === 'SafeKeyedRead';
      const { key } = node as ng.KeyedRead | ng.SafeKeyedRead;
      /* istanbul ignore next */
      const receiver = Object.prototype.hasOwnProperty.call(node, 'receiver')
        ? (node as ng.KeyedRead).receiver
        : (node as any).obj;
      const tKey = _t<b.Expression>(key);
      return _transformReceiverAndName(
        receiver,
        tKey,
        {
          computed: true,
          optional: isOptionalType,
        },
        {
          end: node.sourceSpan.end, // ]
          hasParentParens: isInParentParens,
        },
      );
    }
    case 'LiteralArray': {
      const { expressions } = node as ng.LiteralArray;
      return _c<b.ArrayExpression>(
        'ArrayExpression',
        { elements: expressions.map<b.Expression>(_t) },
        node.sourceSpan,
        { hasParentParens: isInParentParens },
      );
    }
    case 'LiteralMap': {
      const { keys, values } = node as ng.LiteralMap;
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
          ? _c<b.StringLiteral>('StringLiteral', { value: key }, keySpan)
          : _c<b.Identifier>('Identifier', { name: key }, keySpan);
        const shorthand = tKey.end < tKey.start || keyStart === valueStart;

        return _c<b.ObjectProperty>(
          'ObjectProperty',
          {
            key: tKey,
            value: tValue,
            shorthand,
            computed: false,
          },
          { start: getOuterStart(tKey), end: valueEnd },
        );
      });
      return _c<b.ObjectExpression>(
        'ObjectExpression',
        { properties: tProperties },
        node.sourceSpan,
        { hasParentParens: isInParentParens },
      );
    }
    case 'LiteralPrimitive': {
      const { value } = node as ng.LiteralPrimitive;
      switch (typeof value) {
        case 'boolean':
          return _c<b.BooleanLiteral>(
            'BooleanLiteral',
            { value },
            node.sourceSpan,
            {
              hasParentParens: isInParentParens,
            },
          );
        case 'number':
          return _c<b.NumericLiteral>(
            'NumericLiteral',
            { value },
            node.sourceSpan,
            {
              hasParentParens: isInParentParens,
            },
          );
        case 'object':
          return _c<b.NullLiteral>('NullLiteral', {}, node.sourceSpan, {
            hasParentParens: isInParentParens,
          });
        case 'string':
          return _c<b.StringLiteral>(
            'StringLiteral',
            { value },
            node.sourceSpan,
            {
              hasParentParens: isInParentParens,
            },
          );
        case 'undefined':
          return _c<b.Identifier>(
            'Identifier',
            { name: 'undefined' },
            node.sourceSpan,
            { hasParentParens: isInParentParens },
          );
        // istanbul ignore next
        default:
          throw new Error(
            `Unexpected LiteralPrimitive value type ${typeof value}`,
          );
      }
    }
    case 'Call':
    case 'SafeCall': {
      const isOptionalType = type === 'SafeCall';
      const { receiver, args } = node as ng.Call | ng.SafeCall;
      const tArgs =
        args.length === 1
          ? [_transformHasParentParens<b.Expression>(args[0])]
          : (args as ng.AST[]).map<b.Expression>(_t);
      const tReceiver = _t<b.Expression>(receiver!);
      const isOptionalReceiver = _isOptionalReceiver(tReceiver);
      const nodeType =
        isOptionalType || isOptionalReceiver
          ? 'OptionalCallExpression'
          : 'CallExpression';
      return _c<b.CallExpression | b.OptionalCallExpression>(
        nodeType,
        {
          callee: tReceiver,
          arguments: tArgs,
          optional:
            nodeType === 'OptionalCallExpression' ? isOptionalType : undefined,
        },
        {
          start: getOuterStart(tReceiver),
          end: node.sourceSpan.end, // )
        },
        { hasParentParens: isInParentParens },
      );
    }
    case 'NonNullAssert': {
      const { expression } = node as ng.NonNullAssert;
      const tExpression = _t<b.Expression>(expression);
      return _c<b.TSNonNullExpression>(
        'TSNonNullExpression',
        { expression: tExpression },
        {
          start: getOuterStart(tExpression),
          end: node.sourceSpan.end, // !
        },
        { hasParentParens: isInParentParens },
      );
    }
    case 'PrefixNot': {
      const { expression } = node as ng.PrefixNot;
      const tExpression = _t<b.Expression>(expression);
      return _c<b.UnaryExpression>(
        'UnaryExpression',
        {
          prefix: true,
          operator: '!',
          argument: tExpression,
        },
        {
          start: node.sourceSpan.start, // !
          end: getOuterEnd(tExpression),
        },
        { hasParentParens: isInParentParens },
      );
    }
    case 'PropertyRead':
    case 'SafePropertyRead': {
      const isOptionalType = type === 'SafePropertyRead';
      const { receiver, name } = node as ng.PropertyRead | ng.SafePropertyRead;
      const nameEnd =
        context.getCharacterLastIndex(/\S/, node.sourceSpan.end - 1) + 1;
      const tName = _c<b.Identifier>(
        'Identifier',
        { name },
        { start: nameEnd - name.length, end: nameEnd },
        _isImplicitThis(receiver) ? { hasParentParens: isInParentParens } : {},
      );
      return _transformReceiverAndName(
        receiver,
        tName,
        {
          computed: false,
          optional: isOptionalType,
        },
        { hasParentParens: isInParentParens },
      );
    }
    case 'KeyedWrite': {
      const { key, value } = node as ng.KeyedWrite;
      /* istanbul ignore next */
      const receiver = Object.prototype.hasOwnProperty.call(node, 'receiver')
        ? (node as ng.KeyedRead).receiver
        : (node as any).obj;
      const tKey = _t<b.Expression>(key);
      const tValue = _t<b.Expression>(value);
      const tReceiverAndName = _transformReceiverAndName(
        receiver,
        tKey,
        {
          computed: true,
          optional: false,
        },
        { end: context.getCharacterIndex(']', getOuterEnd(tKey)) + 1 },
      );
      return _c<b.AssignmentExpression>(
        'AssignmentExpression',
        {
          left: tReceiverAndName as b.MemberExpression,
          operator: '=',
          right: tValue,
        },
        { start: getOuterStart(tReceiverAndName), end: getOuterEnd(tValue) },
        { hasParentParens: isInParentParens },
      );
    }
    case 'PropertyWrite': {
      const { receiver, name, value } = node as ng.PropertyWrite;
      const tValue = _t<b.Expression>(value);
      const nameEnd =
        context.getCharacterLastIndex(
          /\S/,
          context.getCharacterLastIndex('=', getOuterStart(tValue) - 1) - 1,
        ) + 1;
      const tName = _c<b.Identifier>(
        'Identifier',
        { name },
        { start: nameEnd - name.length, end: nameEnd },
      );
      const tReceiverAndName = _transformReceiverAndName(receiver, tName, {
        computed: false,
        optional: false,
      });
      return _c<b.AssignmentExpression>(
        'AssignmentExpression',
        {
          left: tReceiverAndName as b.MemberExpression,
          operator: '=',
          right: tValue,
        },
        { start: getOuterStart(tReceiverAndName), end: getOuterEnd(tValue) },
        { hasParentParens: isInParentParens },
      );
    }
    // istanbul ignore next
    default:
      throw new Error(`Unexpected node ${type}`);
  }

  function _t<T extends NGNode>(n: ng.AST) {
    return transform(n, context) as T;
  }
  function _transformHasParentParens<T extends NGNode>(n: ng.AST) {
    return transform(n, context, true) as T;
  }

  function _c<T extends NGNode>(
    type: T['type'],
    properties: Partial<T>,
    span: RawNGSpan,
    { processSpan = true, hasParentParens = false } = {},
  ) {
    return createNode<T>(context, type, properties, span, {
      processSpan,
      hasParentParens,
    });
  }

  function _transformReceiverAndName(
    receiver: ng.AST,
    tName: b.Expression,
    props: { computed: boolean; optional: boolean },
    { end = getOuterEnd(tName), hasParentParens = false } = {},
  ) {
    if (
      _isImplicitThis(receiver) ||
      receiver.sourceSpan.start === tName.start
    ) {
      return tName;
    }
    const tReceiver = _t<b.Expression>(receiver);
    const isOptionalReceiver = _isOptionalReceiver(tReceiver);
    return _c<b.OptionalMemberExpression | b.MemberExpression>(
      props.optional || isOptionalReceiver
        ? 'OptionalMemberExpression'
        : 'MemberExpression',
      {
        object: tReceiver,
        property: tName,
        computed: props.computed,
        ...(props.optional
          ? { optional: true }
          : isOptionalReceiver
            ? { optional: false }
            : null),
      },
      { start: getOuterStart(tReceiver), end },
      { hasParentParens },
    );
  }

  function _isImplicitThis(n: ng.AST): boolean {
    return (
      n.sourceSpan.start >= n.sourceSpan.end ||
      /^\s+$/.test(context.text.slice(n.sourceSpan.start, n.sourceSpan.end))
    );
  }

  function _isOptionalReceiver(node: NGNode): boolean {
    return (
      (node.type === 'OptionalCallExpression' ||
        node.type === 'OptionalMemberExpression') &&
      !isParenthesized(node)
    );
  }
}

export default transform;
