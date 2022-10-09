import { parseBinding } from '../src/index.js';

test('error message', () => {
  expect(() => parseBinding('a b c')).toThrowErrorMatchingInlineSnapshot(
    `"Unexpected token 'b'"`,
  );
});
