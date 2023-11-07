import type * as ng from '@angular/compiler';
import type * as b from '@babel/types';
import {
  parseAction,
  parseBinding,
  parseInterpolationExpression,
  parseSimpleBinding,
} from '../src/index.js';
import type { NGNode } from '../src/types.js';
import {
  getNgType,
  parseNgAction,
  parseNgBinding,
  parseNgInterpolationExpression,
  parseNgSimpleBinding,
} from '../src/utils.js';
import {
  massageAst,
  parseBabel,
  parseBabelExpression,
  snapshotAst,
} from './helpers.js';

describe.each`
  beforeType            | afterType                     | input                       | action   | binding  | simple   | interpolation
  ${'Binary'}           | ${'BinaryExpression'}         | ${' 0 - 1 '}                | ${true}  | ${true}  | ${true}  | ${true}
  ${'Binary'}           | ${'LogicalExpression'}        | ${' a && b '}               | ${true}  | ${true}  | ${true}  | ${true}
  ${'Binary'}           | ${'LogicalExpression'}        | ${' a ?? b '}               | ${true}  | ${true}  | ${true}  | ${true}
  ${'Unary'}            | ${'UnaryExpression'}          | ${' - 1 '}                  | ${true}  | ${true}  | ${true}  | ${true}
  ${'Unary'}            | ${'UnaryExpression'}          | ${' + 1 '}                  | ${true}  | ${true}  | ${true}  | ${true}
  ${'BindingPipe'}      | ${'NGPipeExpression'}         | ${' a | b '}                | ${false} | ${true}  | ${false} | ${true}
  ${'BindingPipe'}      | ${'NGPipeExpression'}         | ${' a | b : c '}            | ${false} | ${true}  | ${false} | ${true}
  ${'Chain'}            | ${'NGChainedExpression'}      | ${' a ; b '}                | ${true}  | ${false} | ${false} | ${false}
  ${'Conditional'}      | ${'ConditionalExpression'}    | ${' a ? 1 : 2 '}            | ${true}  | ${true}  | ${true}  | ${true}
  ${'EmptyExpr'}        | ${'NGEmptyExpression'}        | ${''}                       | ${true}  | ${true}  | ${true}  | ${true}
  ${'Call'}             | ${'CallExpression'}           | ${' ( a . b ) ( 1 , 2 ) '}  | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafeCall'}         | ${'OptionalCallExpression'}   | ${' ( a . b )?.( 1 , 2 ) '} | ${true}  | ${true}  | ${true}  | ${true}
  ${'Call'}             | ${'CallExpression'}           | ${' ( a ) ( 1 , 2 ) '}      | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafeCall'}         | ${'OptionalCallExpression'}   | ${' ( a )?.( 1 , 2 ) '}     | ${true}  | ${true}  | ${true}  | ${true}
  ${'Call'}             | ${'CallExpression'}           | ${' a ( 1 ) ( 2 ) '}        | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafeCall'}         | ${'OptionalCallExpression'}   | ${' a ( 1 )?.( 2 ) '}       | ${true}  | ${true}  | ${true}  | ${true}
  ${'KeyedRead'}        | ${'MemberExpression'}         | ${' a [ b ] '}              | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafeKeyedRead'}    | ${'OptionalMemberExpression'} | ${' a ?. [ b ] '}           | ${true}  | ${true}  | ${true}  | ${true}
  ${'KeyedRead'}        | ${'OptionalMemberExpression'} | ${' a ?. b [ c ] '}         | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafeKeyedRead'}    | ${'OptionalMemberExpression'} | ${' a ?. b ?. [ c ] '}      | ${true}  | ${true}  | ${true}  | ${true}
  ${'KeyedRead'}        | ${'OptionalMemberExpression'} | ${' a ?. b () [ c ] '}      | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafeKeyedRead'}    | ${'OptionalMemberExpression'} | ${' a ?. b () ?. [ c ] '}   | ${true}  | ${true}  | ${true}  | ${true}
  ${'KeyedWrite'}       | ${'AssignmentExpression'}     | ${' a [ b ] = 1 '}          | ${true}  | ${true}  | ${true}  | ${true}
  ${'ImplicitReceiver'} | ${'ThisExpression'}           | ${' this '}                 | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralArray'}     | ${'ArrayExpression'}          | ${' [ 1 ] '}                | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralMap'}       | ${'ObjectExpression'}         | ${' ( { "a" : 1 } )'}       | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralMap'}       | ${'ObjectExpression'}         | ${' ( { a : 1 } ) '}        | ${true}  | ${true}  | ${true}  | ${true}
  ${'Call'}             | ${'CallExpression'}           | ${' f ( { a : 1 } ) '}      | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralMap'}       | ${'ObjectExpression'}         | ${' ( {a, b: 2} ) '}        | ${true}  | ${true}  | ${true}  | ${true}
  ${'Call'}             | ${'CallExpression'}           | ${' f ( {a, b: 2} ) '}      | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralMap'}       | ${'ObjectExpression'}         | ${' ( {a, b} ) '}           | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralMap'}       | ${'ObjectExpression'}         | ${' ( { a, b} ) '}          | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralPrimitive'} | ${'BooleanLiteral'}           | ${' true '}                 | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralPrimitive'} | ${'Identifier'}               | ${' undefined '}            | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralPrimitive'} | ${'NullLiteral'}              | ${' null '}                 | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralPrimitive'} | ${'NumericLiteral'}           | ${' ( 1 ) '}                | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralPrimitive'} | ${'NumericLiteral'}           | ${' 1 '}                    | ${true}  | ${true}  | ${true}  | ${true}
  ${'LiteralPrimitive'} | ${'StringLiteral'}            | ${' ( "hello" ) '}          | ${true}  | ${true}  | ${true}  | ${true}
  ${'Call'}             | ${'CallExpression'}           | ${' a ( this ) '}           | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafeCall'}         | ${'OptionalCallExpression'}   | ${' a ?.( this ) '}         | ${true}  | ${true}  | ${true}  | ${true}
  ${'Call'}             | ${'CallExpression'}           | ${' a ( b) '}               | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafeCall'}         | ${'OptionalCallExpression'}   | ${' a ?.( b) '}             | ${true}  | ${true}  | ${true}  | ${true}
  ${'Call'}             | ${'CallExpression'}           | ${' a . b ( 1 , 2 ) '}      | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafeCall'}         | ${'OptionalCallExpression'}   | ${' a . b ?.( 1 , 2 ) '}    | ${true}  | ${true}  | ${true}  | ${true}
  ${'Call'}             | ${'CallExpression'}           | ${' a ( 1 , 2 ) '}          | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafeCall'}         | ${'OptionalCallExpression'}   | ${' a ?. ( 1 , 2 ) '}       | ${true}  | ${true}  | ${true}  | ${true}
  ${'Call'}             | ${'OptionalCallExpression'}   | ${' a ?. b . c ( ) '}       | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafeCall'}         | ${'OptionalCallExpression'}   | ${' a ?. b . c ?. ( ) '}    | ${true}  | ${true}  | ${true}  | ${true}
  ${'Call'}             | ${'OptionalCallExpression'}   | ${' a ?. b ( ) . c ( ) '}   | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafeCall'}         | ${'OptionalCallExpression'}   | ${' a ?. b ( ) . c ?.( ) '} | ${true}  | ${true}  | ${true}  | ${true}
  ${'NonNullAssert'}    | ${'TSNonNullExpression'}      | ${' x ! '}                  | ${true}  | ${true}  | ${true}  | ${true}
  ${'PrefixNot'}        | ${'UnaryExpression'}          | ${' ! x '}                  | ${true}  | ${true}  | ${true}  | ${true}
  ${'PropertyRead'}     | ${'Identifier'}               | ${' ( ( a ) ) '}            | ${true}  | ${true}  | ${true}  | ${true}
  ${'PropertyRead'}     | ${'Identifier'}               | ${' a '}                    | ${true}  | ${true}  | ${true}  | ${true}
  ${'PropertyRead'}     | ${'Identifier'}               | ${' a // hello '}           | ${true}  | ${true}  | ${true}  | ${true}
  ${'PropertyRead'}     | ${'MemberExpression'}         | ${' a . b '}                | ${true}  | ${true}  | ${true}  | ${true}
  ${'PropertyRead'}     | ${'MemberExpression'}         | ${' this . a '}             | ${true}  | ${true}  | ${true}  | ${true}
  ${'PropertyRead'}     | ${'OptionalMemberExpression'} | ${' a ?. b . c '}           | ${true}  | ${true}  | ${true}  | ${true}
  ${'PropertyRead'}     | ${'OptionalMemberExpression'} | ${' a ?. b ( ) . c '}       | ${true}  | ${true}  | ${true}  | ${true}
  ${'PropertyWrite'}    | ${'AssignmentExpression'}     | ${' a . b = 1 '}            | ${true}  | ${false} | ${false} | ${false}
  ${'PropertyWrite'}    | ${'AssignmentExpression'}     | ${' a = 1 '}                | ${true}  | ${false} | ${false} | ${false}
  ${'Call'}             | ${'OptionalCallExpression'}   | ${' a ?. b ( ) '}           | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafeCall'}         | ${'OptionalCallExpression'}   | ${' a ?. b ?. ( ) '}        | ${true}  | ${true}  | ${true}  | ${true}
  ${'SafePropertyRead'} | ${'OptionalMemberExpression'} | ${' a ?. b '}               | ${true}  | ${true}  | ${true}  | ${true}
`('$input ($beforeType -> $afterType)', (fields) => {
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
        expect(() => (beforeNode = parseBefore(input).ast)).not.toThrow();
        expect(() => (afterNode = parseAfter(input))).not.toThrow();
      });
    } else {
      test(`disallowed in ${section}`, () => {
        expect(() => parseBefore(input)).toThrow();
        expect(() => parseAfter(input)).toThrow();
      });
    }
  };

  testSection('action', parseNgAction, parseAction);
  testSection('binding', parseNgBinding, parseBinding);
  testSection('simple', parseNgSimpleBinding, parseSimpleBinding);
  testSection(
    'interpolation',
    parseNgInterpolationExpression,
    parseInterpolationExpression,
  );

  test('ast', () => {
    expect(beforeNode).not.toEqual(null);
    expect(afterNode).not.toEqual(null);

    expect(getNgType(beforeNode!)).toEqual(beforeType);
    expect(afterNode!.type).toEqual(afterType);

    if (afterNode!.type.startsWith('NG')) {
      expect(snapshotAst(afterNode, input)).toMatchSnapshot();
    } else {
      try {
        expect(afterNode).toEqual(massageAst(parseBabelExpression(input)));
      } catch {
        const { comments, program } = parseBabel(input);
        const statement = program.body[0] as b.ExpressionStatement;
        expect(statement.type).toEqual('ExpressionStatement');
        expect(massageAst(afterNode)).toEqual(
          massageAst({ ...statement.expression, comments }),
        );
      }
    }
  });
});
