import type * as b from '@babel/types';
import { parseTemplateBindings } from '../src/index.js';
import type { NGMicrosyntaxKeyedExpression } from '../src/types.js';
import { snapshotAst } from './helpers.js';

test.each`
  input                                                   | types
  ${''}                                                   | ${[]}
  ${' let hero '}                                         | ${['NGMicrosyntaxLet']}
  ${' let hero = hello '}                                 | ${['NGMicrosyntaxLet']}
  ${' let hero of heroes '}                               | ${['NGMicrosyntaxLet', 'NGMicrosyntaxKeyedExpression']}
  ${' let hero ; of : heroes '}                           | ${['NGMicrosyntaxLet', 'NGMicrosyntaxKeyedExpression']}
  ${' as b '}                                             | ${['NGMicrosyntaxAs']}
  ${' a '}                                                | ${['NGMicrosyntaxExpression']}
  ${' a as b '}                                           | ${['NGMicrosyntaxExpression']}
  ${' a , b '}                                            | ${['NGMicrosyntaxExpression', 'NGMicrosyntaxKey']}
  ${' a ; b '}                                            | ${['NGMicrosyntaxExpression', 'NGMicrosyntaxKey']}
  ${' a ; b c '}                                          | ${['NGMicrosyntaxExpression', 'NGMicrosyntaxKeyedExpression']}
  ${' a ; b : c '}                                        | ${['NGMicrosyntaxExpression', 'NGMicrosyntaxKeyedExpression']}
  ${' a ; b : c as d '}                                   | ${['NGMicrosyntaxExpression', 'NGMicrosyntaxKeyedExpression']}
  ${' a ; b as c '}                                       | ${['NGMicrosyntaxExpression', 'NGMicrosyntaxAs']}
  ${' let "a" = "b" ; "c" as "d" '}                       | ${['NGMicrosyntaxLet', 'NGMicrosyntaxAs']}
  ${' let "\\"" '}                                        | ${['NGMicrosyntaxLet']}
  ${' let item of items; index as i; trackBy: trackByFn'} | ${[]}
  ${' item of items; track item '}                        | ${[]}
  ${' item of items;index as i; trackBy: trackByFn'}      | ${[]}
`('$input', ({ input, types }) => {
  const ast = parseTemplateBindings(input);
  expect(snapshotAst(ast, input)).toMatchSnapshot();
  expect(ast.body.map((node) => node.type)).toEqual(types);
});

test('Shorthand', () => {
  const code = 'someTmpl; context: {app}';
  const ast = parseTemplateBindings(code);
  const secondExpression = ast.body[1] as NGMicrosyntaxKeyedExpression;
  const objectExpression = secondExpression.expression
    .expression as b.ObjectExpression;
  const firstProperty = objectExpression.properties[0] as b.ObjectProperty;
  expect(firstProperty.shorthand).toBe(true);
});
