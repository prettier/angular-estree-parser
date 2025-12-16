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
  expectedAngularType | expectedEstreeType    | text                                  | parseAction | parseBinding | parseSimpleBinding | parseInterpolationExpression
  ${'Binary'}         | ${'BinaryExpression'} | ${' ( ( ( ( a ) ) in ( ( b ) ) ) ) '} | ${true}     | ${true}      | ${true}            | ${true}
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
