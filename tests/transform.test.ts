import type * as angular from '@angular/compiler';

import * as angularParser from '../src/angular-parser.js';
import * as estreeParser from '../src/estree-parser.js';
import type { NGNode } from '../src/types.js';
import {
  getAngularNodeType,
  massageAst,
  parseBabelExpression,
  snapshotAst,
} from './helpers.js';

const PARSE_METHODS = [
  'parseAction',
  'parseBinding',
  'parseSimpleBinding',
  'parseInterpolationExpression',
] as const;

type TestCase = {
  expectedAngularType: string;
  expectedEstreeType: NGNode['type'];
  text: string;
  only?: true;
} & {
  [MethodName in (typeof PARSE_METHODS)[number]]?: false;
};

const testCases: TestCase[] = [
  {
    expectedAngularType: 'Binary',
    expectedEstreeType: 'BinaryExpression',
    text: ' ( ( ( ( 0 ) ) - ( ( 1 ) ) ) ) ',
  },
  {
    expectedAngularType: 'Binary',
    expectedEstreeType: 'BinaryExpression',
    text: ' ( ( ( ( a ) ) ** ( ( b ) ) ) ) ',
  },
  {
    expectedAngularType: 'Binary',
    expectedEstreeType: 'BinaryExpression',
    text: ' ( ( ( ( a ) ) in ( ( b ) ) ) ) ',
  },
  {
    expectedAngularType: 'Binary',
    expectedEstreeType: 'LogicalExpression',
    text: ' ( ( ( ( a ) ) && ( ( b ) ) ) ) ',
  },
  {
    expectedAngularType: 'Binary',
    expectedEstreeType: 'LogicalExpression',
    text: ' ( ( ( ( a ) ) || ( ( b ) ) ) ) ',
  },
  {
    expectedAngularType: 'Binary',
    expectedEstreeType: 'LogicalExpression',
    text: ' ( ( ( ( a ) ) ?? ( ( b ) ) ) ) ',
  },
  {
    expectedAngularType: 'Binary',
    expectedEstreeType: 'AssignmentExpression',
    text: ' ( ( a . b = ( ( 1 ) ) ) ) ',
    parseBinding: false,
    parseSimpleBinding: false,
    parseInterpolationExpression: false,
  },
  {
    expectedAngularType: 'Binary',
    expectedEstreeType: 'AssignmentExpression',
    text: ' ( ( a = ( ( 1 ) ) ) ) ',
    parseBinding: false,
    parseSimpleBinding: false,
    parseInterpolationExpression: false,
  },
  {
    expectedAngularType: 'Binary',
    expectedEstreeType: 'AssignmentExpression',
    text: ' a [ b ] = 1 ',
  },
  {
    expectedAngularType: 'Binary',
    expectedEstreeType: 'AssignmentExpression',
    text: ' ( ( a ??= ( ( 1 ) ) ) ) ',
    parseBinding: false,
    parseSimpleBinding: false,
    parseInterpolationExpression: false,
  },
  {
    expectedAngularType: 'Unary',
    expectedEstreeType: 'UnaryExpression',
    text: ' - 1 ',
  },
  {
    expectedAngularType: 'Unary',
    expectedEstreeType: 'UnaryExpression',
    text: ' + 1 ',
  },
  {
    expectedAngularType: 'BindingPipe',
    expectedEstreeType: 'NGPipeExpression',
    text: ' ( ( ( ( a ) ) |  b  ) ) ',
    parseAction: false,
    parseSimpleBinding: false,
  },
  {
    expectedAngularType: 'BindingPipe',
    expectedEstreeType: 'NGPipeExpression',
    text: ' a | b : c ',
    parseAction: false,
    parseSimpleBinding: false,
  },
  {
    expectedAngularType: 'BindingPipe',
    expectedEstreeType: 'NGPipeExpression',
    text: ' a | b : ( ( c ) ) ',
    parseAction: false,
    parseSimpleBinding: false,
  },
  {
    expectedAngularType: 'Chain',
    expectedEstreeType: 'NGChainedExpression',
    text: ' a ; b ',
    parseBinding: false,
    parseSimpleBinding: false,
    parseInterpolationExpression: false,
  },
  {
    expectedAngularType: 'Conditional',
    expectedEstreeType: 'ConditionalExpression',
    text: ' ( ( ( ( a ) ) ? ( ( 1 ) ) : ( ( 2 ) ) ))',
  },
  {
    expectedAngularType: 'EmptyExpr',
    expectedEstreeType: 'NGEmptyExpression',
    text: '',
  },
  {
    expectedAngularType: 'Call',
    expectedEstreeType: 'CallExpression',
    text: ' ( ( ( ( a . b ) ) ( 1 , 2 ) ) ) ',
  },
  {
    expectedAngularType: 'SafeCall',
    expectedEstreeType: 'OptionalCallExpression',
    text: ' ( ( ( ( a . b ) )?.( 1 , 2 ) ) ) ',
  },
  {
    expectedAngularType: 'Call',
    expectedEstreeType: 'CallExpression',
    text: ' ( ( ( ( a ) ) ( 1 , 2 ) ) ) ',
  },
  {
    expectedAngularType: 'SafeCall',
    expectedEstreeType: 'OptionalCallExpression',
    text: ' ( ( ( ( a ) ) ?. ( 1 , 2 ) ) ) ',
  },
  {
    expectedAngularType: 'Call',
    expectedEstreeType: 'CallExpression',
    text: ' ( ( a ( ( ( 1 ) ) ) ( ( ( 1 ) ) ) ) ) ',
  },
  {
    expectedAngularType: 'SafeCall',
    expectedEstreeType: 'OptionalCallExpression',
    text: ' a ( 1 )?.( 2 ) ',
  },
  {
    expectedAngularType: 'KeyedRead',
    expectedEstreeType: 'MemberExpression',
    text: ' a [ b ] ',
  },
  {
    expectedAngularType: 'SafeKeyedRead',
    expectedEstreeType: 'OptionalMemberExpression',
    text: ' a ?. [ b ] ',
  },
  {
    expectedAngularType: 'KeyedRead',
    expectedEstreeType: 'OptionalMemberExpression',
    text: ' a ?. b [ c ] ',
  },
  {
    expectedAngularType: 'SafeKeyedRead',
    expectedEstreeType: 'OptionalMemberExpression',
    text: ' a ?. b ?. [ c ] ',
  },
  {
    expectedAngularType: 'KeyedRead',
    expectedEstreeType: 'OptionalMemberExpression',
    text: ' a ?. b () [ c ] ',
  },
  {
    expectedAngularType: 'SafeKeyedRead',
    expectedEstreeType: 'OptionalMemberExpression',
    text: ' a ?. b () ?. [ c ] ',
  },
  {
    expectedAngularType: 'ThisReceiver',
    expectedEstreeType: 'ThisExpression',
    text: ' ( ( this ) ) ',
  },
  {
    expectedAngularType: 'PropertyRead',
    expectedEstreeType: 'MemberExpression',
    text: ' ( ( this.a ) ) ',
  },
  {
    expectedAngularType: 'LiteralArray',
    expectedEstreeType: 'ArrayExpression',
    text: ' ( ( [ ( ( 1 ) ), ] ) ) ',
  },
  {
    expectedAngularType: 'LiteralArray',
    expectedEstreeType: 'ArrayExpression',
    text: ' ( ( [ ( ( 1 ) ), ... ( ( a ) ) ] ) ) ',
  },
  {
    expectedAngularType: 'LiteralMap',
    expectedEstreeType: 'ObjectExpression',
    text: ' ( ( { "a" : ( ( 1 ) ), } ) )',
  },
  {
    expectedAngularType: 'LiteralMap',
    expectedEstreeType: 'ObjectExpression',
    text: ' ( ( { "a" : ( ( 1 ) ), ...( ( a ) ) } ) )',
  },
  {
    expectedAngularType: 'LiteralMap',
    expectedEstreeType: 'ObjectExpression',
    text: ' { "a" : ( ( 1 ) ) }',
  },
  {
    expectedAngularType: 'LiteralMap',
    expectedEstreeType: 'ObjectExpression',
    text: ' ( ( { a : 1 } )  ) ',
  },
  {
    expectedAngularType: 'Call',
    expectedEstreeType: 'CallExpression',
    text: ' f ( { a : 1 } ) ',
  },
  {
    expectedAngularType: 'LiteralMap',
    expectedEstreeType: 'ObjectExpression',
    text: ' ( {a, b: 2} ) ',
  },
  {
    expectedAngularType: 'Call',
    expectedEstreeType: 'CallExpression',
    text: ' f ( {a, b: 2} ) ',
  },
  {
    expectedAngularType: 'LiteralMap',
    expectedEstreeType: 'ObjectExpression',
    text: ' ( {a, b} ) ',
  },
  {
    expectedAngularType: 'LiteralMap',
    expectedEstreeType: 'ObjectExpression',
    text: ' ( { a, b} ) ',
  },
  {
    expectedAngularType: 'LiteralPrimitive',
    expectedEstreeType: 'BooleanLiteral',
    text: ' true ',
  },
  {
    expectedAngularType: 'LiteralPrimitive',
    expectedEstreeType: 'Identifier',
    text: ' undefined ',
  },
  {
    expectedAngularType: 'LiteralPrimitive',
    expectedEstreeType: 'NullLiteral',
    text: ' null ',
  },
  {
    expectedAngularType: 'LiteralPrimitive',
    expectedEstreeType: 'NumericLiteral',
    text: ' ( 1 ) ',
  },
  {
    expectedAngularType: 'LiteralPrimitive',
    expectedEstreeType: 'NumericLiteral',
    text: ' 1 ',
  },
  {
    expectedAngularType: 'LiteralPrimitive',
    expectedEstreeType: 'StringLiteral',
    text: ' ( "hello" ) ',
  },
  {
    expectedAngularType: 'RegularExpressionLiteral',
    expectedEstreeType: 'RegExpLiteral',
    text: ' ( ( /\\d+/ ) ) ',
  },
  {
    expectedAngularType: 'RegularExpressionLiteral',
    expectedEstreeType: 'RegExpLiteral',
    text: ' ( ( /\\d+/g ) )',
  },
  {
    expectedAngularType: 'Call',
    expectedEstreeType: 'CallExpression',
    text: ' a ( this ) ',
  },
  {
    expectedAngularType: 'SafeCall',
    expectedEstreeType: 'OptionalCallExpression',
    text: ' a ?.( this ) ',
  },
  {
    expectedAngularType: 'Call',
    expectedEstreeType: 'CallExpression',
    text: ' a ( b) ',
  },
  {
    expectedAngularType: 'SafeCall',
    expectedEstreeType: 'OptionalCallExpression',
    text: ' a ?.( b) ',
  },
  {
    expectedAngularType: 'Call',
    expectedEstreeType: 'CallExpression',
    text: ' a . b ( 1 , 2 ) ',
  },
  {
    expectedAngularType: 'SafeCall',
    expectedEstreeType: 'OptionalCallExpression',
    text: ' a . b ?.( 1 , 2 ) ',
  },
  {
    expectedAngularType: 'Call',
    expectedEstreeType: 'CallExpression',
    text: ' a ( 1 , 2 ) ',
  },
  {
    expectedAngularType: 'SafeCall',
    expectedEstreeType: 'OptionalCallExpression',
    text: ' a ?. ( 1 , 2 ) ',
  },
  {
    expectedAngularType: 'Call',
    expectedEstreeType: 'OptionalCallExpression',
    text: ' a ?. b . c ( ) ',
  },
  {
    expectedAngularType: 'SafeCall',
    expectedEstreeType: 'OptionalCallExpression',
    text: ' a ?. b . c ?. ( ) ',
  },
  {
    expectedAngularType: 'Call',
    expectedEstreeType: 'OptionalCallExpression',
    text: ' a ?. b ( ) . c ( ) ',
  },
  {
    expectedAngularType: 'SafeCall',
    expectedEstreeType: 'OptionalCallExpression',
    text: ' a ?. b ( ) . c ?.( ) ',
  },
  {
    expectedAngularType: 'NonNullAssert',
    expectedEstreeType: 'TSNonNullExpression',
    text: ' ( ( ( ( x ) ) ! ) ) ',
  },
  {
    expectedAngularType: 'PropertyRead',
    expectedEstreeType: 'Identifier',
    text: ' ( ( a ) ) ',
  },
  {
    expectedAngularType: 'PropertyRead',
    expectedEstreeType: 'Identifier',
    text: ' a ',
  },
  {
    expectedAngularType: 'PropertyRead',
    expectedEstreeType: 'MemberExpression',
    text: ' a . b ',
  },
  {
    expectedAngularType: 'PropertyRead',
    expectedEstreeType: 'MemberExpression',
    text: ' this . a ',
  },
  {
    expectedAngularType: 'PropertyRead',
    expectedEstreeType: 'OptionalMemberExpression',
    text: ' a ?. b . c ',
  },
  {
    expectedAngularType: 'PropertyRead',
    expectedEstreeType: 'OptionalMemberExpression',
    text: ' a ?. b ( ) . c ',
  },
  {
    expectedAngularType: 'PropertyRead',
    expectedEstreeType: 'OptionalMemberExpression',
    text: ' foo?.bar!.bam ',
  },
  {
    expectedAngularType: 'PropertyRead',
    expectedEstreeType: 'MemberExpression',
    text: ' (foo?.bar)!.bam ',
  },
  {
    expectedAngularType: 'PropertyRead',
    expectedEstreeType: 'MemberExpression',
    text: ' (foo?.bar!).bam ',
  },
  {
    expectedAngularType: 'Call',
    expectedEstreeType: 'OptionalCallExpression',
    text: ' a ?. b ( ) ',
  },
  {
    expectedAngularType: 'SafeCall',
    expectedEstreeType: 'OptionalCallExpression',
    text: ' a ?. b ?. ( ) ',
  },
  {
    expectedAngularType: 'SafePropertyRead',
    expectedEstreeType: 'OptionalMemberExpression',
    text: ' a ?. b ',
  },
  {
    expectedAngularType: 'PrefixNot',
    expectedEstreeType: 'UnaryExpression',
    text: ' ( ( ! ( ( x ) ) ) ) ',
  },
  {
    expectedAngularType: 'TypeofExpression',
    expectedEstreeType: 'UnaryExpression',
    text: ' ( ( typeof ( ( x ) ) ) ) ',
  },
  {
    expectedAngularType: 'VoidExpression',
    expectedEstreeType: 'UnaryExpression',
    text: ' ( ( void ( ( x ) ) ) ) ',
  },
  {
    expectedAngularType: 'Binary',
    expectedEstreeType: 'BinaryExpression',
    text: ' typeof {} === "object" ',
  },
  {
    expectedAngularType: 'TemplateLiteral',
    expectedEstreeType: 'TemplateLiteral',
    text: ' ` a ${ b } \\u0063 ` ',
  },
  {
    expectedAngularType: 'TemplateLiteral',
    expectedEstreeType: 'TemplateLiteral',
    text: ' ( ( ` a ${ b } \\u0063 ` ) ) ',
  },
  {
    expectedAngularType: 'TemplateLiteral',
    expectedEstreeType: 'TemplateLiteral',
    text: ' `  \\u0063  ` ',
  },
  {
    expectedAngularType: 'TemplateLiteral',
    expectedEstreeType: 'TemplateLiteral',
    text: ' ( ( `   ` ) ) ',
  },
  {
    expectedAngularType: 'TemplateLiteral',
    expectedEstreeType: 'TemplateLiteral',
    text: ' `` ',
  },
  {
    expectedAngularType: 'TaggedTemplateLiteral',
    expectedEstreeType: 'TaggedTemplateExpression',
    text: ' tag ` a ${ b } \\u0063 ` ',
  },
  {
    expectedAngularType: 'TaggedTemplateLiteral',
    expectedEstreeType: 'TaggedTemplateExpression',
    text: ' ( ( ( ( tag ) ) ` a ${ b } \\u0063 ` ) ) ',
  },
  {
    expectedAngularType: 'LiteralMap',
    expectedEstreeType: 'ObjectExpression',
    text: ' ( ( {foo: ` a ${ b } ` } ) ) ',
  },
  {
    expectedAngularType: 'LiteralMap',
    expectedEstreeType: 'ObjectExpression',
    text: ' ( ( {foo: tag ` a ${ b } ` } ) ) ',
  },
];

const IS_CI = Boolean(process.env.CI);

for (const testCase of testCases) {
  const { expectedAngularType, expectedEstreeType, only = false } = testCase;

  if (IS_CI && only) {
    throw new Error(`Unexpected 'only' property`);
  }

  (only ? describe.only : describe)(
    `('${expectedAngularType}' -> '${expectedEstreeType}')`,
    () => {
      for (const method of PARSE_METHODS) {
        runTest(testCase, method);
        runTest(
          { ...testCase, text: `\r\n${testCase.text} \r\n // comment` },
          method,
        );
        runTest(
          { ...testCase, text: `\r${testCase.text} \r // comment` },
          method,
        );
      }
    },
  );
}

function runTest(testCase: TestCase, method: (typeof PARSE_METHODS)[number]) {
  const { expectedAngularType, expectedEstreeType, text } = testCase;
  const isAllowed = testCase[method] ?? true;
  const parseAngular = angularParser[method];
  const parseEstree = estreeParser[method];

  if (!isAllowed) {
    test(`disallowed in ${method}`, () => {});
    return;
  }

  test(`${method}(${JSON.stringify(text)})`, () => {
    if (!isAllowed) {
      expect(() => parseAngular(text)).toThrow();
      expect(() => parseEstree(text)).toThrow();
    }

    let angularNode = parseAngular(text).result.ast;
    if (method === 'parseInterpolationExpression') {
      angularNode = (angularNode as angular.Interpolation).expressions[0];
    }
    expect(angularNode).toBeDefined();
    expect(getAngularNodeType(angularNode)).toEqual(expectedAngularType);

    const estreeNode = parseEstree(text);
    expect(estreeNode).toBeDefined();
    expect(estreeNode.type).toEqual(expectedEstreeType);

    if (estreeNode.type.startsWith('NG')) {
      expect(snapshotAst(estreeNode, text)).toMatchSnapshot();
      return;
    }

    const babelNode = parseBabelExpression(text);

    expect(babelNode).toBeDefined();
    expect(massageAst(estreeNode, 'angular')).toEqual(
      massageAst(babelNode, 'babel'),
    );
  });
}
