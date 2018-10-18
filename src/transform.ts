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
  getNgType,
  stripSurroundingSpaces,
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

export const transform = (node: InputNode, context: Context): OutputNode => {
  const type = getNgType(node);
  switch (type) {
    case 'Binary': {
      const { left, operation, right } = node as ng.Binary;
      return left.span.start === left.span.end
        ? _c<b.UnaryExpression>('UnaryExpression', {
            prefix: true,
            argument: _t<b.Expression>(right),
            operator: operation as b.UnaryExpression['operator'],
          })
        : _c<b.BinaryExpression>('BinaryExpression', {
            left: _t<b.Expression>(left),
            right: _t<b.Expression>(right),
            operator: operation as b.BinaryExpression['operator'],
          });
    }
    case 'BindingPipe': {
      const { args, exp, name } = node as ng.BindingPipe;
      const left = _t<b.Expression>(exp);
      const rightStart = _findBackChar(/\S/, _findBackChar(/:/, left.end) + 1);
      return _c<NGPipeExpression>('NGPipeExpression', {
        left,
        right: _c<b.Identifier>(
          'Identifier',
          { name },
          { start: rightStart, end: rightStart + name.length },
        ),
        arguments: args.map<b.Expression>(_t),
      });
    }
    case 'Chain': {
      const { expressions } = node as ng.Chain;
      return _c<NGChainedExpression>('NGChainedExpression', {
        expressions: expressions.map<b.Expression>(_t),
      });
    }
    case 'Comment': {
      const { value } = node as RawNGComment;
      return _c<b.CommentLine>('CommentLine', { value }, node.span, false);
    }
    case 'Conditional': {
      const { condition, trueExp, falseExp } = node as ng.Conditional;
      return _c<b.ConditionalExpression>('ConditionalExpression', {
        test: _t<b.Expression>(condition),
        consequent: _t<b.Expression>(trueExp),
        alternate: _t<b.Expression>(falseExp),
      });
    }
    case 'EmptyExpr':
      return _c<NGEmptyExpression>('NGEmptyExpression', {});
    case 'FunctionCall': {
      const { target, args } = node as ng.FunctionCall;
      return _c<b.CallExpression>('CallExpression', {
        callee: _t<b.Expression>(target!),
        arguments: args.map<b.Expression>(_t),
      });
    }
    case 'KeyedRead': {
      const { obj, key } = node as ng.KeyedRead;
      return _c<b.MemberExpression>('MemberExpression', {
        computed: true,
        object: _t<b.Expression>(obj),
        property: _t<b.Expression>(key),
      });
    }
    case 'LiteralArray': {
      const { expressions } = node as ng.LiteralArray;
      return _c<b.ArrayExpression>('ArrayExpression', {
        elements: expressions.map<b.Expression>(_t),
      });
    }
    case 'LiteralMap': {
      const { keys, values } = node as ng.LiteralMap;
      return _c<b.ObjectExpression>('ObjectExpression', {
        properties: keys.map((literalMapKey, index) => {
          const value = _t<b.Expression>(values[index]);
          const keyEnd = _findFrontChar(/[^\s:]/, value.start - 1) + 1;
          const { key: keyName, quoted } = literalMapKey;
          const key = quoted
            ? _c<b.StringLiteral>(
                'StringLiteral',
                { value: keyName },
                { end: keyEnd, start: keyEnd - keyName.length - 2 },
              )
            : _c<b.Identifier>(
                'Identifier',
                { name: keyName },
                { end: keyEnd, start: keyEnd - keyName.length },
              );
          return _c<b.ObjectProperty>(
            'ObjectProperty',
            { key, value, method: false, shorthand: false, computed: false },
            { start: key.start, end: value.end },
          );
        }),
      });
    }
    case 'LiteralPrimitive': {
      const { value } = node as ng.LiteralPrimitive;
      switch (typeof value) {
        case 'boolean':
          return _c<b.BooleanLiteral>('BooleanLiteral', { value });
        case 'number':
          return _c<b.NumericLiteral>('NumericLiteral', { value });
        case 'object':
          return _c<b.NullLiteral>('NullLiteral', {});
        case 'string':
          return _c<b.StringLiteral>('StringLiteral', { value });
        case 'undefined':
          return _c<b.Identifier>('Identifier', { name: 'undefined' });
        // istanbul ignore next
        default:
          throw new Error(
            `Unexpected LiteralPrimitive value type ${typeof value}`,
          );
      }
    }
    case 'MethodCall':
    case 'SafeMethodCall': {
      const isOptional = type === 'SafeMethodCall';
      const { receiver, name, args } = node as
        | ng.MethodCall
        | ng.SafeMethodCall;
      const callExpression = _c<b.CallExpression | b.OptionalCallExpression>(
        isOptional ? 'OptionalCallExpression' : 'CallExpression',
        { arguments: args.map<b.Expression>(_t) },
      );
      if (getNgType(receiver) === 'ImplicitReceiver') {
        callExpression.callee = _c<b.Identifier>(
          'Identifier',
          { name },
          {
            start: callExpression.start,
            end: callExpression.start + name.length,
          },
        );
      } else {
        const object = _t<b.Expression>(receiver);
        const propertyStart = _findBackChar(
          /\S/,
          _findBackChar(/\./, object.end) + 1,
        );
        const property = _c<b.Identifier>(
          'Identifier',
          { name },
          { start: propertyStart, end: propertyStart + name.length },
        );
        callExpression.callee = _c<
          b.MemberExpression | b.OptionalMemberExpression
        >(
          isOptional ? 'OptionalMemberExpression' : 'MemberExpression',
          {
            computed: false,
            object,
            property,
            ...(isOptional && { optional: true }),
          },
          { start: object.start, end: property.end },
        );
      }
      return callExpression;
    }
    case 'NonNullAssert': {
      const { expression } = node as ng.NonNullAssert;
      return _c<b.TSNonNullExpression>('TSNonNullExpression', {
        expression: _t<b.Expression>(expression),
      });
    }
    case 'PrefixNot': {
      const { expression } = node as ng.PrefixNot;
      return _c<b.UnaryExpression>('UnaryExpression', {
        prefix: true,
        operator: '!',
        argument: _t<b.Expression>(expression),
      });
    }
    case 'PropertyRead':
    case 'SafePropertyRead': {
      const isOptional = type === 'SafePropertyRead';
      const { name, receiver } = node as ng.PropertyRead | ng.SafePropertyRead;
      if (getNgType(receiver) === 'ImplicitReceiver') {
        return _c<b.Identifier>('Identifier', { name });
      }
      const memberExpression = _c<
        b.MemberExpression | b.OptionalMemberExpression
      >(isOptional ? 'OptionalMemberExpression' : 'MemberExpression', {
        computed: false,
        object: _t<b.Expression>(receiver),
        ...(isOptional && { optional: true }),
      });
      memberExpression.property = _c<b.Identifier>(
        'Identifier',
        { name },
        {
          end: memberExpression.end,
          start: memberExpression.end - name.length,
        },
      );
      return memberExpression;
    }
    case 'KeyedWrite':
    case 'PropertyWrite': {
      const { value } = node as ng.PropertyWrite | ng.KeyedWrite;
      const memberExpressionEnd =
        _findFrontChar(/\S/, _findFrontChar(/=/, value.span.start - 1) - 1) + 1;
      const memberExpression = _t<b.MemberExpression>(
        Object.assign({}, node, {
          type: type === 'KeyedWrite' ? 'KeyedRead' : 'PropertyRead',
          span: { start: node.span.start, end: memberExpressionEnd },
        }),
      );
      return _c<b.AssignmentExpression>('AssignmentExpression', {
        left: memberExpression,
        operator: '=',
        right: _t<b.Expression>(value),
      });
    }
    case 'Quote': {
      const { prefix, uninterpretedExpression } = node as ng.Quote;
      return _c<NGQuotedExpression>('NGQuotedExpression', {
        prefix,
        value: uninterpretedExpression,
      });
    }
    // istanbul ignore next
    default:
      throw new Error(`Unexpected node ${type}`);
  }

  function _t<T extends OutputNode>(n: InputNode) {
    return transform(n, context) as T & RawNGSpan;
  }

  function _c<T extends OutputNode>(
    t: T['type'],
    n: Partial<T>,
    span: RawNGSpan = node.span,
    stripSpaces = true,
  ) {
    const newNode: T & RawNGSpan = {
      type: t,
      ...transformSpan(span, context, stripSpaces),
      // @ts-ignore
      ...n,
    };
    switch (t) {
      case 'Identifier': {
        const identifier = newNode as b.Identifier;
        identifier.loc!.identifierName = identifier.name;
        break;
      }
      case 'NumericLiteral': {
        const numericLiteral = newNode as b.NumberLiteral;
        numericLiteral.extra = {
          raw: context.text.slice(numericLiteral.start!, numericLiteral.end!),
          rawValue: numericLiteral.value,
        };
        break;
      }
      case 'StringLiteral': {
        const stringLiteral = newNode as b.StringLiteral;
        stringLiteral.extra = {
          raw: context.text.slice(stringLiteral.start!, stringLiteral.end!),
          rawValue: stringLiteral.value,
        };
        break;
      }
    }
    return newNode;
  }

  function _findFrontChar(regex: RegExp, index: number) {
    return findFrontChar(regex, index, context.text);
  }

  function _findBackChar(regex: RegExp, index: number) {
    return findBackChar(regex, index, context.text);
  }
};

export function transformSpan(
  span: RawNGSpan,
  context: Context,
  stripSpaces: boolean,
): {
  start: NonNullable<b.BaseNode['start']>;
  end: NonNullable<b.BaseNode['end']>;
  loc: NonNullable<b.BaseNode['loc']>;
} {
  const { start, end } = stripSpaces
    ? stripSurroundingSpaces(span.start, span.end, context.text)
    : span;
  return {
    start,
    end,
    loc: {
      start: context.locator.locationForIndex(start),
      end: context.locator.locationForIndex(end),
    },
  };
}
