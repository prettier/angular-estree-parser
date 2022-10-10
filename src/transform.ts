import type * as ng from '@angular/compiler';
import type * as b from '@babel/types';
import { Context } from './context.js';
import type {
  NGChainedExpression,
  NGEmptyExpression,
  NGNode,
  NGPipeExpression,
  NGQuotedExpression,
  RawNGComment,
  RawNGSpan,
} from './types.js';
import {
  findBackChar,
  findFrontChar,
  fitSpans,
  getLast,
  getNgType,
} from './utils.js';

declare module '@babel/types' {
  interface SourceLocation {
    identifierName?: string;
  }
  interface NumericLiteral {
    extra: { raw: string; rawValue: number };
  }
  interface StringLiteral {
    extra: { raw: string; rawValue: string };
  }
  interface ObjectProperty {
    method: boolean;
  }
  type CommentLine = Pick<
    b.CommentLine,
    Exclude<keyof b.CommentLine, 'type'>
  > & { type: 'CommentLine' };
  interface BaseNode {
    type: b.Node['type'];
    leadingComments?: b.Comment[] | null;
    innerComments?: b.Comment[] | null;
    trailingComments?: b.Comment[] | null;
    start?: number | null;
    end?: number | null;
    loc?: SourceLocation | null;
    range?: [number, number];
    extra?: Record<string, unknown>;
  }
}

export type InputNode = ng.AST | RawNGComment;
export type OutputNode = NGNode | b.CommentLine;

export const transform = (
  node: InputNode,
  context: Context,
  isInParentParens = false,
): OutputNode => {
  const type = getNgType(node);
  switch (type) {
    case 'Unary': {
      // @ts-ignore: there is no `Unary` in `@angular/compiler@<10.1.0`
      const { operator, expr } = node as ng.Unary;
      const tArgument = _t<b.Expression>(expr);
      return _c<b.UnaryExpression>(
        'UnaryExpression',
        {
          prefix: true,
          argument: tArgument,
          operator: operator as '-' | '+',
        },
        node.span,
        { hasParentParens: isInParentParens },
      );
    }
    case 'Binary': {
      const { left, operation, right } = node as ng.Binary;
      const isPrefixAdd = right.span.start === right.span.end; // +1 === 1 - 0
      const isPrefixMinus = left.span.start === left.span.end; // -1 === 0 - 1
      // `@angular/compiler` changed this to `Unary` since `v10.1.0`
      // istanbul ignore next
      if (isPrefixAdd || isPrefixMinus) {
        const tArgument =
          left.span.start === left.span.end
            ? _t<b.Expression>(right)
            : _t<b.Expression>(left);
        return _c<b.UnaryExpression>(
          'UnaryExpression',
          {
            prefix: true,
            argument: tArgument,
            operator: isPrefixAdd ? '+' : '-',
          },
          {
            start: node.span.start, // operator
            end: _getOuterEnd(tArgument),
          },
          { hasParentParens: isInParentParens },
        );
      }
      const tLeft = _t<b.Expression>(left);
      const tRight = _t<b.Expression>(right);
      return _c<b.LogicalExpression | b.BinaryExpression>(
        operation === '&&' || operation === '||'
          ? 'LogicalExpression'
          : 'BinaryExpression',
        {
          left: tLeft,
          right: tRight,
          // @ts-ignore
          operator: operation,
        },
        { start: _getOuterStart(tLeft), end: _getOuterEnd(tRight) },
        { hasParentParens: isInParentParens },
      );
    }
    case 'BindingPipe': {
      const { exp, name, args } = node as ng.BindingPipe;
      const tExp = _t<b.Expression>(exp);
      const nameStart = _findBackChar(
        /\S/,
        _findBackChar(/\|/, _getOuterEnd(tExp)) + 1,
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
          start: _getOuterStart(tExp),
          end: _getOuterEnd(tArgs.length === 0 ? tName : getLast(tArgs)!),
        },
        { hasParentParens: isInParentParens },
      );
    }
    case 'Chain': {
      const { expressions } = node as ng.Chain;
      return _c<NGChainedExpression>(
        'NGChainedExpression',
        { expressions: expressions.map<b.Expression>(_t) },
        node.span,
        { hasParentParens: isInParentParens },
      );
    }
    case 'Comment': {
      const { value } = node as RawNGComment;
      return _c<b.CommentLine>('CommentLine', { value }, node.span, {
        processSpan: false,
      });
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
        { start: _getOuterStart(tCondition), end: _getOuterEnd(tFalseExp) },
        { hasParentParens: isInParentParens },
      );
    }
    case 'EmptyExpr':
      return _c<NGEmptyExpression>('NGEmptyExpression', {}, node.span, {
        hasParentParens: isInParentParens,
      });
    case 'ImplicitReceiver': {
      return _c<b.ThisExpression>('ThisExpression', {}, node.span, {
        hasParentParens: isInParentParens,
      });
    }
    case 'KeyedRead': {
      const { key } = node as ng.KeyedRead;
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
          optional: false,
        },
        {
          end: node.span.end, // ]
          hasParentParens: isInParentParens,
        },
      );
    }
    case 'LiteralArray': {
      const { expressions } = node as ng.LiteralArray;
      return _c<b.ArrayExpression>(
        'ArrayExpression',
        { elements: expressions.map<b.Expression>(_t) },
        node.span,
        { hasParentParens: isInParentParens },
      );
    }
    case 'LiteralMap': {
      const { keys, values } = node as ng.LiteralMap;
      const tValues = values.map((value) => _t<b.Expression>(value));
      const tProperties = keys.map(({ key, quoted }, index) => {
        const tValue = tValues[index];
        const keyStart = _findBackChar(
          /\S/,
          index === 0
            ? node.span.start + 1 // {
            : _findBackChar(/,/, _getOuterEnd(tValues[index - 1])) + 1,
        );
        const keyEnd =
          _findFrontChar(
            /\S/,
            _findFrontChar(/:/, _getOuterStart(tValue) - 1) - 1,
          ) + 1;
        const keySpan = { start: keyStart, end: keyEnd };
        const tKey = quoted
          ? _c<b.StringLiteral>('StringLiteral', { value: key }, keySpan)
          : _c<b.Identifier>('Identifier', { name: key }, keySpan);
        const shorthand = tKey.end < tKey.start;

        return _c<b.ObjectProperty>(
          'ObjectProperty',
          {
            key: tKey,
            value: tValue,
            method: false,
            shorthand,
            computed: false,
          },
          { start: _getOuterStart(tKey), end: _getOuterEnd(tValue) },
        );
      });
      return _c<b.ObjectExpression>(
        'ObjectExpression',
        { properties: tProperties },
        node.span,
        { hasParentParens: isInParentParens },
      );
    }
    case 'LiteralPrimitive': {
      const { value } = node as ng.LiteralPrimitive;
      switch (typeof value) {
        case 'boolean':
          return _c<b.BooleanLiteral>('BooleanLiteral', { value }, node.span, {
            hasParentParens: isInParentParens,
          });
        case 'number':
          return _c<b.NumericLiteral>('NumericLiteral', { value }, node.span, {
            hasParentParens: isInParentParens,
          });
        case 'object':
          return _c<b.NullLiteral>('NullLiteral', {}, node.span, {
            hasParentParens: isInParentParens,
          });
        case 'string':
          return _c<b.StringLiteral>('StringLiteral', { value }, node.span, {
            hasParentParens: isInParentParens,
          });
        case 'undefined':
          return _c<b.Identifier>(
            'Identifier',
            { name: 'undefined' },
            node.span,
            { hasParentParens: isInParentParens },
          );
        // istanbul ignore next
        default:
          throw new Error(
            `Unexpected LiteralPrimitive value type ${typeof value}`,
          );
      }
    }
    case 'FunctionCall': {
      // @ts-ignore: removed in `@angular/compiler@14`
      const { target, args } = node as ng.FunctionCall;
      const tArgs =
        args.length === 1
          ? [_transformHasParentParens<b.Expression>(args[0])]
          : args.map<b.Expression>(_t);
      const tTarget = _t<b.Expression>(target!);
      return _c<b.CallExpression>(
        'CallExpression',
        {
          callee: tTarget,
          arguments: tArgs,
        },
        {
          start: _getOuterStart(tTarget),
          end: node.span.end, // )
        },
        { hasParentParens: isInParentParens },
      );
    }
    case 'MethodCall':
    case 'SafeMethodCall': {
      const isOptionalType = type === 'SafeMethodCall';
      const { receiver, name, args } = node as  // @ts-ignore: removed in `@angular/compiler@14`
        | ng.MethodCall
        // @ts-ignore: removed in `@angular/compiler@14`
        | ng.SafeMethodCall;
      const tArgs =
        args.length === 1
          ? [_transformHasParentParens<b.Expression>(args[0])]
          : (args as any[]).map<b.Expression>(_t);
      const nameEnd =
        _findFrontChar(
          /\S/,
          _findFrontChar(
            /\(/,
            (tArgs.length === 0
              ? _findFrontChar(/\)/, node.span.end - 1)
              : _getOuterStart(tArgs[0])) - 1,
          ) - 1,
        ) + 1;
      const tName = _c<b.Identifier>(
        'Identifier',
        { name },
        { start: nameEnd - name.length, end: nameEnd },
      );
      const tReceiverAndName = _transformReceiverAndName(receiver, tName, {
        computed: false,
        optional: isOptionalType,
      });
      const isOptionalReceiver = _isOptionalReceiver(tReceiverAndName);
      const nodeType =
        isOptionalType || isOptionalReceiver
          ? 'OptionalCallExpression'
          : 'CallExpression';
      return _c<b.CallExpression | b.OptionalCallExpression>(
        nodeType,
        {
          callee: tReceiverAndName,
          arguments: tArgs,
          optional: nodeType === 'OptionalCallExpression' ? false : undefined,
        },
        {
          start: _getOuterStart(tReceiverAndName),
          end: node.span.end, // )
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
          start: _getOuterStart(tExpression),
          end: node.span.end, // !
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
          start: node.span.start, // !
          end: _getOuterEnd(tExpression),
        },
        { hasParentParens: isInParentParens },
      );
    }
    case 'PropertyRead':
    case 'SafePropertyRead': {
      const isOptionalType = type === 'SafePropertyRead';
      const { receiver, name } = node as ng.PropertyRead | ng.SafePropertyRead;
      const nameEnd = _findFrontChar(/\S/, node.span.end - 1) + 1;
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
        { end: _findBackChar(/\]/, _getOuterEnd(tKey)) + 1 },
      );
      return _c<b.AssignmentExpression>(
        'AssignmentExpression',
        {
          left: tReceiverAndName as b.MemberExpression,
          operator: '=',
          right: tValue,
        },
        { start: _getOuterStart(tReceiverAndName), end: _getOuterEnd(tValue) },
        { hasParentParens: isInParentParens },
      );
    }
    case 'PropertyWrite': {
      const { receiver, name, value } = node as ng.PropertyWrite;
      const tValue = _t<b.Expression>(value);
      const nameEnd =
        _findFrontChar(
          /\S/,
          _findFrontChar(/=/, _getOuterStart(tValue) - 1) - 1,
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
        { start: _getOuterStart(tReceiverAndName), end: _getOuterEnd(tValue) },
        { hasParentParens: isInParentParens },
      );
    }
    case 'Quote': {
      // @ts-ignore: removed in `@angular/compiler@14`
      const { prefix, uninterpretedExpression } = node as ng.Quote;
      return _c<NGQuotedExpression>(
        'NGQuotedExpression',
        {
          prefix,
          value: uninterpretedExpression,
        },
        node.span,
        { hasParentParens: isInParentParens },
      );
    }
    // istanbul ignore next
    default:
      throw new Error(`Unexpected node ${type}`);
  }

  function _t<T extends OutputNode>(n: InputNode) {
    return transform(n, context) as T & RawNGSpan;
  }
  function _transformHasParentParens<T extends OutputNode>(n: InputNode) {
    return transform(n, context, true) as T & RawNGSpan;
  }

  function _c<T extends OutputNode>(
    t: T['type'],
    n: Partial<T>,
    span: RawNGSpan,
    { processSpan = true, hasParentParens = false } = {},
  ) {
    const newNode = {
      type: t,
      ...transformSpan(span, context, processSpan, hasParentParens),
      // @ts-ignore
      ...n,
    } as T & RawNGSpan;
    switch (t) {
      case 'Identifier': {
        const identifier = newNode as unknown as b.Identifier;
        identifier.loc!.identifierName = identifier.name;
        break;
      }
      case 'NumericLiteral': {
        const numericLiteral = newNode as unknown as b.NumberLiteral;
        numericLiteral.extra = {
          ...numericLiteral.extra,
          raw: context.text.slice(numericLiteral.start!, numericLiteral.end!),
          rawValue: numericLiteral.value,
        };
        break;
      }
      case 'StringLiteral': {
        const stringLiteral = newNode as unknown as b.StringLiteral;
        stringLiteral.extra = {
          ...stringLiteral.extra,
          raw: context.text.slice(stringLiteral.start!, stringLiteral.end!),
          rawValue: stringLiteral.value,
        };
        break;
      }
    }
    return newNode;
  }

  function _transformReceiverAndName(
    receiver: ng.AST,
    tName: b.Expression,
    props: { computed: boolean; optional: boolean },
    { end = _getOuterEnd(tName), hasParentParens = false } = {},
  ) {
    if (_isImplicitThis(receiver) || receiver.span.start === tName.start) {
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
      { start: _getOuterStart(tReceiver), end },
      { hasParentParens },
    );
  }

  function _findFrontChar(regex: RegExp, index: number) {
    return findFrontChar(regex, index, context.text);
  }

  function _findBackChar(regex: RegExp, index: number) {
    return findBackChar(regex, index, context.text);
  }

  function _isImplicitThis(n: ng.AST): boolean {
    return (
      n.span.start >= n.span.end ||
      /^\s+$/.test(context.text.slice(n.span.start, n.span.end))
    );
  }

  function _isOptionalReceiver(n: OutputNode): boolean {
    return (
      (n.type === 'OptionalCallExpression' ||
        n.type === 'OptionalMemberExpression') &&
      !_isParenthesized(n)
    );
  }
  function _isParenthesized(n: OutputNode): boolean {
    // @ts-ignore
    return n.extra && n.extra.parenthesized;
  }
  function _getOuterStart(n: OutputNode): number {
    // @ts-ignore
    return _isParenthesized(n) ? n.extra.parenStart : n.start;
  }
  function _getOuterEnd(n: OutputNode): number {
    // @ts-ignore
    return _isParenthesized(n) ? n.extra.parenEnd : n.end;
  }
};

export function transformSpan(
  span: RawNGSpan,
  context: Context,
  processSpan = false,
  hasParentParens = false,
): {
  start: NonNullable<b.BaseNode['start']>;
  end: NonNullable<b.BaseNode['end']>;
  loc: NonNullable<b.BaseNode['loc']>;
} {
  if (!processSpan) {
    const { start, end } = span;
    return {
      start,
      end,
      loc: {
        start: context.locator.locationForIndex(start),
        end: context.locator.locationForIndex(end),
      },
    };
  }

  const { outerSpan, innerSpan, hasParens } = fitSpans(
    span,
    context.text,
    hasParentParens,
  );
  return {
    start: innerSpan.start,
    end: innerSpan.end,
    loc: {
      start: context.locator.locationForIndex(innerSpan.start),
      end: context.locator.locationForIndex(innerSpan.end),
    },
    ...(hasParens && {
      extra: {
        parenthesized: true,
        parenStart: outerSpan.start,
        parenEnd: outerSpan.end,
      },
    }),
  };
}
