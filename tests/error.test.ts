import { parseBinding, parseTemplateBindings } from '../src/index.js';

test('error message', () => {
  expect(() => parseBinding('a\nb c')).toThrowErrorMatchingInlineSnapshot(
    `[SyntaxError: Parser Error: Unexpected token 'b']`,
  );
  expect(() => parseBinding('---')).toThrowErrorMatchingInlineSnapshot(
    `[SyntaxError: Parser Error: Unexpected end of expression: --- at the end of the expression [---]]`,
  );
  expect(() =>
    parseTemplateBindings('---\n'),
  ).toThrowErrorMatchingInlineSnapshot(
    `
    [SyntaxError: Parser Error: Unexpected end of expression: ---
     at the end of the expression [---
    ]]
  `,
  );
});
