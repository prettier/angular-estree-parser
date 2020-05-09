import * as ng from '@angular/compiler/src/expression_parser/ast';
import * as b from '@babel/types';
import { Context } from './context';
import {
  NGChainedExpression,
  NGEmptyExpression,
  NGNode,
  NGPipeExpression,
  NGQuotedExpression,
  RawNGComment,
  RawNGSpan,
} from './types';
import {
  findBackChar,
  findFrontChar,
  fitSpans,
  getLast,
  getNgType,
} from './utils';

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
    b.LineComment,
    Exclude<keyof b.LineComment, 'type'>
  > & { type: 'CommentLine' };
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
    case 'Binary': {
      const { left, operation, right } = node as ng.Binary;
      const isPrefixAdd = right.span.start === right.span.end; // +1 === 1 - 0
      const isPrefixMinus = left.span.start === left.span.end; // -1 === 0 - 1
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
    case 'FunctionCall': {
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
    case 'KeyedRead': {
      const { obj, key } = node as ng.KeyedRead;
      const tKey = _t<b.Expression>(key);
      return _transformReceiverAndName(
        obj,
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
      const tValues = values.map(value => _t<b.Expression>(value));
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
        return _c<b.ObjectProperty>(
          'ObjectProperty',
          {
            key: tKey,
            value: tValue,
            method: false,
            shorthand: false,
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
    case 'MethodCall':
    case 'SafeMethodCall': {
      const isOptionalType = type === 'SafeMethodCall';
      const { receiver, name, args } = node as
        | ng.MethodCall
        | ng.SafeMethodCall;
      const tArgs =
        args.length === 1
          ? [_transformHasParentParens<b.Expression>(args[0])]
          : args.map<b.Expression>(_t);
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
      return _c<b.CallExpression | b.OptionalCallExpression>(
        isOptionalType || isOptionalReceiver
          ? 'OptionalCallExpression'
          : 'CallExpression',
        {
          callee: tReceiverAndName,
          arguments: tArgs,
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
        // special case
        receiver.span.start === receiver.span.end
          ? { hasParentParens: isInParentParens }
          : {},
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
      const { obj, key, value } = node as ng.KeyedWrite;
      const tKey = _t<b.Expression>(key);
      const tValue = _t<b.Expression>(value);
      const tReceiverAndName = _transformReceiverAndName(
        obj,
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
        const identifier = newNode as b.Identifier;
        identifier.loc!.identifierName = identifier.name;
        break;
      }
      case 'NumericLiteral': {
        const numericLiteral = newNode as b.NumberLiteral;
        numericLiteral.extra = {
          ...numericLiteral.extra,
          raw: context.text.slice(numericLiteral.start!, numericLiteral.end!),
          rawValue: numericLiteral.value,
        };
        break;
      }
      case 'StringLiteral': {
        const stringLiteral = newNode as b.StringLiteral;
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
    if (receiver.span.start >= receiver.span.end) {
      return tName;
    }
    const tReceiver =
      getNgType(receiver) === 'ImplicitReceiver'
        ? _c<b.ThisExpression>('ThisExpression', {}, receiver.span)
        : _t<b.Expression>(receiver);
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
