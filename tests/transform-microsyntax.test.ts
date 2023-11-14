import type * as b from '@babel/types';
import { parseTemplateBindings } from '../src/index.js';
import type { NGMicrosyntaxKeyedExpression } from '../src/types.js';
import { snapshotAst } from './helpers.js';

test.each`
  input                                                   | types
  ${''}                                                   | ${[]}
  ${' let hero '}                                         | ${['VariableDeclaration']}
  ${' let hero = hello '}                                 | ${['VariableDeclaration']}
  ${' let hero of heroes '}                               | ${['NGMicrosyntaxOfExpression']}
  ${' let hero ; of : heroes '}                           | ${['VariableDeclaration', 'NGMicrosyntaxKeyedExpression']}
  ${' as b '}                                             | ${['NGMicrosyntaxAsExpression']}
  ${' a '}                                                | ${['Identifier']}
  ${' a as b '}                                           | ${['Identifier', 'NGMicrosyntaxAsExpression']}
  ${' a , b '}                                            | ${['Identifier', 'Identifier']}
  ${' a ; b '}                                            | ${['Identifier', 'Identifier']}
  ${' a ; b c '}                                          | ${['Identifier', 'NGMicrosyntaxKeyedExpression']}
  ${' a ; b : c '}                                        | ${['Identifier', 'NGMicrosyntaxKeyedExpression']}
  ${' a ; b : c as d '}                                   | ${['Identifier', 'NGMicrosyntaxKeyedExpression', 'NGMicrosyntaxAsExpression']}
  ${' a ; b as c '}                                       | ${['Identifier', 'NGMicrosyntaxAsExpression']}
  ${' let "a" = "b" ; "c" as "d" '}                       | ${['VariableDeclaration', 'NGMicrosyntaxAsExpression']}
  ${' let "\\"" '}                                        | ${['VariableDeclaration']}
  ${' let item of items; index as i; trackBy: trackByFn'} | ${['NGMicrosyntaxOfExpression', 'NGMicrosyntaxAsExpression', 'NGMicrosyntaxKeyedExpression']}
  ${' item of items; track item '}                        | ${['NGMicrosyntaxOfExpression', 'NGMicrosyntaxKeyedExpression']}
  ${' item of items;index as i; trackBy: trackByFn'}      | ${['NGMicrosyntaxOfExpression', 'NGMicrosyntaxAsExpression', 'NGMicrosyntaxKeyedExpression']}
`('$input', ({ input, types }) => {
  const ast = parseTemplateBindings(input);
  expect(snapshotAst(ast, input)).toMatchSnapshot();
  expect(ast).toMatchSnapshot();
  expect(ast.body.map((node) => node.type)).toEqual(types);
});

// test('Shorthand', () => {
//   const code = 'someTmpl; context: {app}';
//   const ast = parseTemplateBindings(code);
//   const secondExpression = ast.body[1] as NGMicrosyntaxKeyedExpression;
//   const objectExpression = secondExpression.expression
//     .expression as b.ObjectExpression;
//   const firstProperty = objectExpression.properties[0] as b.ObjectProperty;
//   expect(firstProperty.shorthand).toBe(true);
// });
