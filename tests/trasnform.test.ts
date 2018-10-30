import * as ng from '@angular/compiler/src/expression_parser/ast';
import * as b from '@babel/types';
import {
  parseAction,
  parseBinding,
  parseInterpolation,
  parseSimpleBinding,
} from '../src/index';
import { NGNode } from '../src/types';
import {
  getNgType,
  parseNgAction,
  parseNgBinding,
  parseNgInterpolation,
  parseNgSimpleBinding,
} from '../src/utils';
import {
  massageAst,
  parseBabel,
  parseBabelExpression,
  snapshotAst,
} from './helpers';

describe.each`
  beforeType            | afterType                     | input                       | action   | binding  | simple   | interpolation
  ${'Binary'}           | ${'BinaryExpression'}         | ${' 0 - 1 '}                | ${true}  | ${true}  | ${true}  | ${true}
  ${'Binary'}           | ${'LogicalExpression'}        | ${' a && b '}               | ${true}  | ${true}  | ${true}  | ${true}
  ${'Binary'}           | ${'UnaryExpression'}          | ${' - 1 '}                  | ${true}  | ${true}  | ${true}  | ${true}
  ${'BindingPipe'}      | ${'NGPipeExpression'}         | ${' a | b : c '}            | ${false} | ${true}  | ${false} | ${true}
  ${'Chain'}            | ${'NGChainedExpression'}      | ${' a ; b '}                | ${true}  | ${false} | ${false} | ${false}
  ${'Conditional'}      | ${'ConditionalExpression'}    | ${' a ? 1 : 2 '}            | ${true}  | ${true}  | ${true}  | ${true}
  ${'EmptyExpr'}        | ${'NGEmptyExpression'}        | ${''}                       | ${true}  | ${true}  | ${true}  | ${false}
  ${'FunctionCall'}     | ${'CallExpression'}           | ${' a ( 1 ) ( 2 ) '}        | ${true}  | ${true}  | ${true}  | ${true}
  ${'KeyedRead'}        | ${'MemberExpression'}         | ${' a [ b ] '}              | ${true}  | ${true}  | ${true}  | ${true}
  ${'KeyedWrite'}       | ${'AssignmentExpression'}     | ${' a [ b ] = 1 '}          | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralArray'}     | ${'ArrayExpression'}          | ${' [ 1 ] '}                | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralMap'}       | ${'ObjectExpression'}         | ${' { "a" : 1 } '}          | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralMap'}       | ${'ObjectExpression'}         | ${' { a : 1 } '}            | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralPrimitive'} | ${'BooleanLiteral'}           | ${' true '}                 | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralPrimitive'} | ${'Identifier'}               | ${' undefined '}            | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralPrimitive'} | ${'NullLiteral'}              | ${' null '}                 | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralPrimitive'} | ${'NumericLiteral'}           | ${' ( 1 ) '}                | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralPrimitive'} | ${'NumericLiteral'}           | ${' 1 '}                    | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralPrimitive'} | ${'StringLiteral'}            | ${' "hello" '}              | ${true}  | ${true}  | ${true}  | ${true}
  ${'MethodCall'}       | ${'CallExpression'}           | ${' a . b ( 1 , 2 ) '}      | ${true}  | ${true}  | ${true}  | ${true}
  ${'MethodCall'}       | ${'CallExpression'}           | ${' a ( 1 , 2 ) '}          | ${true}  | ${true}  | ${true}  | ${true}
  ${'NonNullAssert'}    | ${'TSNonNullExpression'}      | ${' x ! '}                  | ${true}  | ${true}  | ${true}  | ${true}
  ${'PrefixNot'}        | ${'UnaryExpression'}          | ${' ! x '}                  | ${true}  | ${true}  | ${true}  | ${true}
  ${'PropertyRead'}     | ${'Identifier'}               | ${' ( ( a ) ) '}            | ${true}  | ${true}  | ${true}  | ${true}
  ${'PropertyRead'}     | ${'Identifier'}               | ${' a '}                    | ${true}  | ${true}  | ${true}  | ${true}
  ${'PropertyRead'}     | ${'Identifier'}               | ${' a // hello '}           | ${true}  | ${true}  | ${true}  | ${true}
  ${'PropertyRead'}     | ${'MemberExpression'}         | ${' a . b '}                | ${true}  | ${true}  | ${true}  | ${true}
  ${'PropertyRead'}     | ${'MemberExpression'}         | ${' this . a '}             | ${true}  | ${true}  | ${true}  | ${true}
  ${'PropertyWrite'}    | ${'AssignmentExpression'}     | ${' a . b = 1 '}            | ${true}  | ${false} | ${false} | ${false}
  ${'PropertyWrite'}    | ${'AssignmentExpression'}     | ${' a = 1 '}                | ${true}  | ${false} | ${false} | ${false}
  ${'Quote'}            | ${'NGQuotedExpression'}       | ${' javascript : void(0) '} | ${false} | ${true}  | ${true}  | ${false}
  ${'SafeMethodCall'}   | ${'OptionalCallExpression'}   | ${' a ?. b ( ) '}           | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafePropertyRead'} | ${'OptionalMemberExpression'} | ${' a ?. b '}               | ${true}  | ${true}  | ${true}  | ${true}
`('$input ($beforeType -> $afterType)', fields => {
  const { beforeType, afterType, input } = fields;

  let beforeNode: ng.AST | null = null;
  let afterNode: NGNode | null = null;

  const testSection = (
    section: Extract<keyof typeof fields, string>,
    parseBefore: (input: string) => { ast: ng.AST },
    parseAfter: (input: string) => NGNode,
  ) => {
    if (fields[section]) {
      test(`allowed in ${section}`, () => {
        expect(() => (beforeNode = parseBefore(input).ast)).not.toThrowError();
        expect(() => (afterNode = parseAfter(input))).not.toThrowError();
      });
    } else {
      test(`disallowed in ${section}`, () => {
        expect(() => parseBefore(input)).toThrowError();
        expect(() => parseAfter(input)).toThrowError();
      });
    }
  };

  testSection('action', parseNgAction, parseAction);
  testSection('binding', parseNgBinding, parseBinding);
  testSection('simple', parseNgSimpleBinding, parseSimpleBinding);
  testSection('interpolation', parseNgInterpolation, parseInterpolation);

  test('ast', () => {
    expect(beforeNode).not.toEqual(null);
    expect(afterNode).not.toEqual(null);

    expect(getNgType(beforeNode!)).toEqual(beforeType);
    expect(afterNode!.type).toEqual(afterType);

    if (afterNode!.type.startsWith('NG')) {
      expect(() => parseBabelExpression(input)).toThrowError();
      expect(snapshotAst(afterNode, input)).toMatchSnapshot();
    } else {
      try {
        expect(afterNode).toEqual(massageAst(parseBabelExpression(input)));
      } catch {
        const { comments, program } = parseBabel(input);
        const statement = program.body[0] as b.ExpressionStatement;
        expect(statement.type).toEqual('ExpressionStatement');
        expect(afterNode).toEqual(
          massageAst({ ...statement.expression, comments }),
        );
      }
    }
  });
});
