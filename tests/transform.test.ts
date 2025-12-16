import type * as angular from '@angular/compiler';
import type * as babelParser from '@babel/parser';
import type * as babel from '@babel/types';

import * as angularParser from '../src/angular-parser.js';
import * as estreeParser from '../src/estree-parser.js';
import type { NGNode } from '../src/types.js';
import {
  getAngularNodeType,
  massageAst,
  parseBabel,
  parseBabelExpression,
  snapshotAst,
} from './helpers.js';

type BabelParseResult = ReturnType<typeof babelParser.parse>;
type BabelParseExpressionResult = ReturnType<
  typeof babelParser.parseExpression
>;

const PARSE_METHODS = [
  'parseAction',
  'parseBinding',
  'parseSimpleBinding',
  'parseInterpolationExpression',
] as const;

describe.each`
  expectedAngularType           | expectedEstreeType            | text                                            | parseAction | parseBinding | parseSimpleBinding | parseInterpolationExpression
  ${'Binary'}                   | ${'BinaryExpression'}         | ${' ( ( ( ( 0 ) ) - ( ( 1 ) ) ) ) '}            | ${true}     | ${true}      | ${true}            | ${true}
  ${'Binary'}                   | ${'BinaryExpression'}         | ${' ( ( ( ( a ) ) ** ( ( b ) ) ) ) '}           | ${true}     | ${true}      | ${true}            | ${true}
  ${'Binary'}                   | ${'BinaryExpression'}         | ${' ( ( ( ( a ) ) in ( ( b ) ) ) ) '}           | ${true}     | ${true}      | ${true}            | ${true}
  ${'Binary'}                   | ${'LogicalExpression'}        | ${' ( ( ( ( a ) ) && ( ( b ) ) ) ) '}           | ${true}     | ${true}      | ${true}            | ${true}
  ${'Binary'}                   | ${'LogicalExpression'}        | ${' ( ( ( ( a ) ) || ( ( b ) ) ) ) '}           | ${true}     | ${true}      | ${true}            | ${true}
  ${'Binary'}                   | ${'LogicalExpression'}        | ${' ( ( ( ( a ) ) ?? ( ( b ) ) ) ) '}           | ${true}     | ${true}      | ${true}            | ${true}
  ${'Binary'}                   | ${'AssignmentExpression'}     | ${' ( ( a . b = ( ( 1 ) ) ) ) '}                | ${true}     | ${false}     | ${false}           | ${false}
  ${'Binary'}                   | ${'AssignmentExpression'}     | ${' ( ( a = ( ( 1 ) ) ) ) '}                    | ${true}     | ${false}     | ${false}           | ${false}
  ${'Binary'}                   | ${'AssignmentExpression'}     | ${' a [ b ] = 1 '}                              | ${true}     | ${true}      | ${true}            | ${true}
  ${'Binary'}                   | ${'AssignmentExpression'}     | ${' ( ( a ??= ( ( 1 ) ) ) ) '}                  | ${true}     | ${false}     | ${false}           | ${false}
  ${'Unary'}                    | ${'UnaryExpression'}          | ${' - 1 '}                                      | ${true}     | ${true}      | ${true}            | ${true}
  ${'Unary'}                    | ${'UnaryExpression'}          | ${' + 1 '}                                      | ${true}     | ${true}      | ${true}            | ${true}
  ${'BindingPipe'}              | ${'NGPipeExpression'}         | ${' ( ( ( ( a ) ) |  b  )) '}                   | ${false}    | ${true}      | ${false}           | ${true}
  ${'BindingPipe'}              | ${'NGPipeExpression'}         | ${' a | b : c '}                                | ${false}    | ${true}      | ${false}           | ${true}
  ${'Chain'}                    | ${'NGChainedExpression'}      | ${' a ; b '}                                    | ${true}     | ${false}     | ${false}           | ${false}
  ${'Conditional'}              | ${'ConditionalExpression'}    | ${' ( ( ( ( a ) ) ? ( ( 1 ) ) : ( ( 2 ) ) ))'}  | ${true}     | ${true}      | ${true}            | ${true}
  ${'EmptyExpr'}                | ${'NGEmptyExpression'}        | ${''}                                           | ${true}     | ${true}      | ${true}            | ${true}
  ${'Call'}                     | ${'CallExpression'}           | ${' ( a . b ) ( 1 , 2 ) '}                      | ${true}     | ${true}      | ${true}            | ${true}
  ${'SafeCall'}                 | ${'OptionalCallExpression'}   | ${' ( a . b )?.( 1 , 2 ) '}                     | ${true}     | ${true}      | ${true}            | ${true}
  ${'Call'}                     | ${'CallExpression'}           | ${' ( a ) ( 1 , 2 ) '}                          | ${true}     | ${true}      | ${true}            | ${true}
  ${'SafeCall'}                 | ${'OptionalCallExpression'}   | ${' ( a )?.( 1 , 2 ) '}                         | ${true}     | ${true}      | ${true}            | ${true}
  ${'Call'}                     | ${'CallExpression'}           | ${' a ( 1 ) ( 2 ) '}                            | ${true}     | ${true}      | ${true}            | ${true}
  ${'SafeCall'}                 | ${'OptionalCallExpression'}   | ${' a ( 1 )?.( 2 ) '}                           | ${true}     | ${true}      | ${true}            | ${true}
  ${'KeyedRead'}                | ${'MemberExpression'}         | ${' a [ b ] '}                                  | ${true}     | ${true}      | ${true}            | ${true}
  ${'SafeKeyedRead'}            | ${'OptionalMemberExpression'} | ${' a ?. [ b ] '}                               | ${true}     | ${true}      | ${true}            | ${true}
  ${'KeyedRead'}                | ${'OptionalMemberExpression'} | ${' a ?. b [ c ] '}                             | ${true}     | ${true}      | ${true}            | ${true}
  ${'SafeKeyedRead'}            | ${'OptionalMemberExpression'} | ${' a ?. b ?. [ c ] '}                          | ${true}     | ${true}      | ${true}            | ${true}
  ${'KeyedRead'}                | ${'OptionalMemberExpression'} | ${' a ?. b () [ c ] '}                          | ${true}     | ${true}      | ${true}            | ${true}
  ${'SafeKeyedRead'}            | ${'OptionalMemberExpression'} | ${' a ?. b () ?. [ c ] '}                       | ${true}     | ${true}      | ${true}            | ${true}
  ${'ImplicitReceiver'}         | ${'ThisExpression'}           | ${' this '}                                     | ${true}     | ${true}      | ${true}            | ${true}
  ${'LiteralArray'}             | ${'ArrayExpression'}          | ${' [ 1 ] '}                                    | ${true}     | ${true}      | ${true}            | ${true}
  ${'LiteralMap'}               | ${'ObjectExpression'}         | ${' ( { "a" : 1 } )'}                           | ${true}     | ${true}      | ${true}            | ${true}
  ${'LiteralMap'}               | ${'ObjectExpression'}         | ${' ( { a : 1 } ) '}                            | ${true}     | ${true}      | ${true}            | ${true}
  ${'Call'}                     | ${'CallExpression'}           | ${' f ( { a : 1 } ) '}                          | ${true}     | ${true}      | ${true}            | ${true}
  ${'LiteralMap'}               | ${'ObjectExpression'}         | ${' ( {a, b: 2} ) '}                            | ${true}     | ${true}      | ${true}            | ${true}
  ${'Call'}                     | ${'CallExpression'}           | ${' f ( {a, b: 2} ) '}                          | ${true}     | ${true}      | ${true}            | ${true}
  ${'LiteralMap'}               | ${'ObjectExpression'}         | ${' ( {a, b} ) '}                               | ${true}     | ${true}      | ${true}            | ${true}
  ${'LiteralMap'}               | ${'ObjectExpression'}         | ${' ( { a, b} ) '}                              | ${true}     | ${true}      | ${true}            | ${true}
  ${'LiteralPrimitive'}         | ${'BooleanLiteral'}           | ${' true '}                                     | ${true}     | ${true}      | ${true}            | ${true}
  ${'LiteralPrimitive'}         | ${'Identifier'}               | ${' undefined '}                                | ${true}     | ${true}      | ${true}            | ${true}
  ${'LiteralPrimitive'}         | ${'NullLiteral'}              | ${' null '}                                     | ${true}     | ${true}      | ${true}            | ${true}
  ${'LiteralPrimitive'}         | ${'NumericLiteral'}           | ${' ( 1 ) '}                                    | ${true}     | ${true}      | ${true}            | ${true}
  ${'LiteralPrimitive'}         | ${'NumericLiteral'}           | ${' 1 '}                                        | ${true}     | ${true}      | ${true}            | ${true}
  ${'LiteralPrimitive'}         | ${'StringLiteral'}            | ${' ( "hello" ) '}                              | ${true}     | ${true}      | ${true}            | ${true}
  ${'RegularExpressionLiteral'} | ${'RegExpLiteral'}            | ${' ( ( /\\d+/ ) ) '}                           | ${true}     | ${true}      | ${true}            | ${true}
  ${'RegularExpressionLiteral'} | ${'RegExpLiteral'}            | ${' ( ( /\\d+/g ) )'}                           | ${true}     | ${true}      | ${true}            | ${true}
  ${'Call'}                     | ${'CallExpression'}           | ${' a ( this ) '}                               | ${true}     | ${true}      | ${true}            | ${true}
  ${'SafeCall'}                 | ${'OptionalCallExpression'}   | ${' a ?.( this ) '}                             | ${true}     | ${true}      | ${true}            | ${true}
  ${'Call'}                     | ${'CallExpression'}           | ${' a ( b) '}                                   | ${true}     | ${true}      | ${true}            | ${true}
  ${'SafeCall'}                 | ${'OptionalCallExpression'}   | ${' a ?.( b) '}                                 | ${true}     | ${true}      | ${true}            | ${true}
  ${'Call'}                     | ${'CallExpression'}           | ${' a . b ( 1 , 2 ) '}                          | ${true}     | ${true}      | ${true}            | ${true}
  ${'SafeCall'}                 | ${'OptionalCallExpression'}   | ${' a . b ?.( 1 , 2 ) '}                        | ${true}     | ${true}      | ${true}            | ${true}
  ${'Call'}                     | ${'CallExpression'}           | ${' a ( 1 , 2 ) '}                              | ${true}     | ${true}      | ${true}            | ${true}
  ${'SafeCall'}                 | ${'OptionalCallExpression'}   | ${' a ?. ( 1 , 2 ) '}                           | ${true}     | ${true}      | ${true}            | ${true}
  ${'Call'}                     | ${'OptionalCallExpression'}   | ${' a ?. b . c ( ) '}                           | ${true}     | ${true}      | ${true}            | ${true}
  ${'SafeCall'}                 | ${'OptionalCallExpression'}   | ${' a ?. b . c ?. ( ) '}                        | ${true}     | ${true}      | ${true}            | ${true}
  ${'Call'}                     | ${'OptionalCallExpression'}   | ${' a ?. b ( ) . c ( ) '}                       | ${true}     | ${true}      | ${true}            | ${true}
  ${'SafeCall'}                 | ${'OptionalCallExpression'}   | ${' a ?. b ( ) . c ?.( ) '}                     | ${true}     | ${true}      | ${true}            | ${true}
  ${'NonNullAssert'}            | ${'TSNonNullExpression'}      | ${' x ! '}                                      | ${true}     | ${true}      | ${true}            | ${true}
  ${'PropertyRead'}             | ${'Identifier'}               | ${' ( ( a ) ) '}                                | ${true}     | ${true}      | ${true}            | ${true}
  ${'PropertyRead'}             | ${'Identifier'}               | ${' a '}                                        | ${true}     | ${true}      | ${true}            | ${true}
  ${'PropertyRead'}             | ${'Identifier'}               | ${' a // hello '}                               | ${true}     | ${true}      | ${true}            | ${true}
  ${'PropertyRead'}             | ${'MemberExpression'}         | ${' a . b '}                                    | ${true}     | ${true}      | ${true}            | ${true}
  ${'PropertyRead'}             | ${'MemberExpression'}         | ${' this . a '}                                 | ${true}     | ${true}      | ${true}            | ${true}
  ${'PropertyRead'}             | ${'OptionalMemberExpression'} | ${' a ?. b . c '}                               | ${true}     | ${true}      | ${true}            | ${true}
  ${'PropertyRead'}             | ${'OptionalMemberExpression'} | ${' a ?. b ( ) . c '}                           | ${true}     | ${true}      | ${true}            | ${true}
  ${'PropertyRead'}             | ${'OptionalMemberExpression'} | ${' foo?.bar!.bam '}                            | ${true}     | ${true}      | ${true}            | ${true}
  ${'PropertyRead'}             | ${'MemberExpression'}         | ${' (foo?.bar)!.bam '}                          | ${true}     | ${true}      | ${true}            | ${true}
  ${'PropertyRead'}             | ${'MemberExpression'}         | ${' (foo?.bar!).bam '}                          | ${true}     | ${true}      | ${true}            | ${true}
  ${'Call'}                     | ${'OptionalCallExpression'}   | ${' a ?. b ( ) '}                               | ${true}     | ${true}      | ${true}            | ${true}
  ${'SafeCall'}                 | ${'OptionalCallExpression'}   | ${' a ?. b ?. ( ) '}                            | ${true}     | ${true}      | ${true}            | ${true}
  ${'SafePropertyRead'}         | ${'OptionalMemberExpression'} | ${' a ?. b '}                                   | ${true}     | ${true}      | ${true}            | ${true}
  ${'PrefixNot'}                | ${'UnaryExpression'}          | ${' ( ( ! ( ( x ) ) ) ) '}                      | ${true}     | ${true}      | ${true}            | ${true}
  ${'TypeofExpression'}         | ${'UnaryExpression'}          | ${' ( ( typeof ( ( x ) ) ) ) '}                 | ${true}     | ${true}      | ${true}            | ${true}
  ${'VoidExpression'}           | ${'UnaryExpression'}          | ${' ( ( void ( ( x ) ) ) ) '}                   | ${true}     | ${true}      | ${true}            | ${true}
  ${'Binary'}                   | ${'BinaryExpression'}         | ${' typeof {} === "object" '}                   | ${true}     | ${true}      | ${true}            | ${true}
  ${'TemplateLiteral'}          | ${'TemplateLiteral'}          | ${' ` a ${ b } \\u0063 ` '}                     | ${true}     | ${true}      | ${true}            | ${true}
  ${'TemplateLiteral'}          | ${'TemplateLiteral'}          | ${' ( ( ` a ${ b } \\u0063 ` ) ) '}             | ${true}     | ${true}      | ${true}            | ${true}
  ${'TemplateLiteral'}          | ${'TemplateLiteral'}          | ${' `  \\u0063  ` '}                            | ${true}     | ${true}      | ${true}            | ${true}
  ${'TemplateLiteral'}          | ${'TemplateLiteral'}          | ${' ( ( `   ` ) ) '}                            | ${true}     | ${true}      | ${true}            | ${true}
  ${'TemplateLiteral'}          | ${'TemplateLiteral'}          | ${' `` '}                                       | ${true}     | ${true}      | ${true}            | ${true}
  ${'TaggedTemplateLiteral'}    | ${'TaggedTemplateExpression'} | ${' tag ` a ${ b } \\u0063 ` '}                 | ${true}     | ${true}      | ${true}            | ${true}
  ${'TaggedTemplateLiteral'}    | ${'TaggedTemplateExpression'} | ${' ( ( ( ( tag ) ) ` a ${ b } \\u0063 ` ) ) '} | ${true}     | ${true}      | ${true}            | ${true}
  ${'LiteralMap'}               | ${'ObjectExpression'}         | ${' ( ( {foo: ` a ${ b } ` } ) ) '}             | ${true}     | ${true}      | ${true}            | ${true}
  ${'LiteralMap'}               | ${'ObjectExpression'}         | ${' ( ( {foo: tag ` a ${ b } ` } ) ) '}         | ${true}     | ${true}      | ${true}            | ${true}
`('($expectedAngularType -> $expectedEstreeType)', (fields) => {
  for (const method of PARSE_METHODS) {
    testSection(method, fields);
  }
});

function testSection(
  method: (typeof PARSE_METHODS)[number],
  fields: {
    expectedAngularType: string;
    expectedEstreeType: string;
    text: string;
    parseAction: boolean;
    parseBinding: boolean;
    parseSimpleBinding: boolean;
    parseInterpolationExpression: boolean;
  },
) {
  const { expectedAngularType, expectedEstreeType, text } = fields;
  const parseAngular = angularParser[method];
  const parseEstree = estreeParser[method];

  const isAllowed = fields[method];
  if (!isAllowed) {
    test(`disallowed in ${method}`, () => {
      expect(() => parseAngular(text)).toThrow();
      expect(() => parseEstree(text)).toThrow();
    });
    return;
  }

  let angularNode: angular.AST;
  let estreeNode: NGNode;
  let babelNode: (
    | BabelParseResult
    | BabelParseExpressionResult
    | babel.Expression
  ) & { comments?: babel.Comment[] | null };

  beforeAll(() => {
    angularNode = parseAngular(text).result.ast;
    if (method === 'parseInterpolationExpression') {
      angularNode = (angularNode as angular.Interpolation).expressions[0];
    }

    estreeNode = parseEstree(text);
    if (!estreeNode.type.startsWith('NG')) {
      try {
        babelNode = parseBabelExpression(text);
      } catch {
        babelNode = parseBabel(text);
      }
    }
  });

  test(`${method}(${JSON.stringify(text)})`, () => {
    expect(angularNode).toBeDefined();
    expect(estreeNode).toBeDefined();

    expect(getAngularNodeType(angularNode)).toEqual(expectedAngularType);
    expect(estreeNode.type).toEqual(expectedEstreeType);

    if (estreeNode.type.startsWith('NG')) {
      expect(snapshotAst(estreeNode, text)).toMatchSnapshot();
      return;
    }

    expect(babelNode).toBeDefined();
    if (babelNode.type === 'File') {
      const { comments = [], program } = babelNode;
      const statement = program.body[0] as babel.ExpressionStatement;
      expect(statement.type).toEqual('ExpressionStatement');
      babelNode = { ...statement.expression, comments };
    }
    expect(massageAst(estreeNode, 'angular')).toEqual(
      massageAst(babelNode, 'babel'),
    );
  });
}
