import type * as babel from '@babel/types';

import { parseTemplateBindings } from '../src/index.js';
import type {
  NGMicrosyntaxKeyedExpression,
  NGMicrosyntaxNode,
} from '../src/types.ts';
import { snapshotAst } from './helpers.js';

const testCases: {
  input: string;
  types: NGMicrosyntaxNode['type'][];
  only?: true;
}[] = [
  { input: '', types: [] },
  { input: ' let hero ', types: ['NGMicrosyntaxLet'] },
  { input: ' let hero = hello ', types: ['NGMicrosyntaxLet'] },
  {
    input: ' let hero of heroes ',
    types: ['NGMicrosyntaxLet', 'NGMicrosyntaxKeyedExpression'],
  },
  {
    input: ' let hero ; of : heroes ',
    types: ['NGMicrosyntaxLet', 'NGMicrosyntaxKeyedExpression'],
  },
  { input: ' as b ', types: ['NGMicrosyntaxAs'] },
  { input: ' a ', types: ['NGMicrosyntaxExpression'] },
  { input: ' a as b ', types: ['NGMicrosyntaxExpression'] },
  { input: ' a , b ', types: ['NGMicrosyntaxExpression', 'NGMicrosyntaxKey'] },
  { input: ' a ; b ', types: ['NGMicrosyntaxExpression', 'NGMicrosyntaxKey'] },
  {
    input: ' a ; b c ',
    types: ['NGMicrosyntaxExpression', 'NGMicrosyntaxKeyedExpression'],
  },
  {
    input: ' a ; b : c ',
    types: ['NGMicrosyntaxExpression', 'NGMicrosyntaxKeyedExpression'],
  },
  {
    input: ' a ; b : c as d ',
    types: ['NGMicrosyntaxExpression', 'NGMicrosyntaxKeyedExpression'],
  },
  {
    input: ' a ; b as c ',
    types: ['NGMicrosyntaxExpression', 'NGMicrosyntaxAs'],
  },
  {
    input: ' let "a" = "b" ; "c" as "d" ',
    types: ['NGMicrosyntaxLet', 'NGMicrosyntaxAs'],
  },
  { input: ' let "\\"" ', types: ['NGMicrosyntaxLet'] },
];

const IS_CI = Boolean(process.env.CI);
for (const { input, types, only } of testCases) {
  if (IS_CI && only) {
    throw new Error(`Unexpected 'only' property`);
  }

  (only ? test.only : test)(`'${input}'`, () => {
    const ast = parseTemplateBindings(input);
    expect(snapshotAst(ast, input)).toMatchSnapshot();
    expect(ast.body.map((node) => node.type)).toEqual(types);
  });
}

test('Shorthand', () => {
  const code = 'someTmpl; context: {app}';
  const ast = parseTemplateBindings(code);
  const secondExpression = ast.body[1] as NGMicrosyntaxKeyedExpression;
  const objectExpression = secondExpression.expression
    .expression as babel.ObjectExpression;
  const firstProperty = objectExpression.properties[0] as babel.ObjectProperty;
  expect(firstProperty.shorthand).toBe(true);
});
