import { parseTemplateBindings } from '../src/index';
import { snapshotAst } from './helpers';

test.each`
  input                             | types
  ${' '}                            | ${[]}
  ${' let hero '}                   | ${['NGMicrosyntaxLet']}
  ${' let hero = hello '}           | ${['NGMicrosyntaxLet']}
  ${' let hero of heroes '}         | ${['NGMicrosyntaxLet', 'NGMicrosyntaxKeyedExpression']}
  ${' let hero ; of : heroes '}     | ${['NGMicrosyntaxLet', 'NGMicrosyntaxKeyedExpression']}
  ${' a '}                          | ${['NGMicrosyntaxExpression']}
  ${' a as b '}                     | ${['NGMicrosyntaxExpression']}
  ${' a , b '}                      | ${['NGMicrosyntaxExpression', 'NGMicrosyntaxKey']}
  ${' a ; b '}                      | ${['NGMicrosyntaxExpression', 'NGMicrosyntaxKey']}
  ${' a ; b c '}                    | ${['NGMicrosyntaxExpression', 'NGMicrosyntaxKeyedExpression']}
  ${' a ; b : c '}                  | ${['NGMicrosyntaxExpression', 'NGMicrosyntaxKeyedExpression']}
  ${' a ; b : c as d '}             | ${['NGMicrosyntaxExpression', 'NGMicrosyntaxKeyedExpression']}
  ${' a ; b as c '}                 | ${['NGMicrosyntaxExpression', 'NGMicrosyntaxAs']}
  ${' let "a" = "b" ; "c" as "d" '} | ${['NGMicrosyntaxLet', 'NGMicrosyntaxAs']}
  ${' let "\\"" '}                  | ${['NGMicrosyntaxLet']}
`('$input', ({ input, types }) => {
  const ast = parseTemplateBindings(input);
  expect(snapshotAst(ast, input)).toMatchSnapshot();
  expect(ast.body.map(node => node.type)).toEqual(types);
});
