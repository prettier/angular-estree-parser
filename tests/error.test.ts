import { parseBinding } from '../src/index';

test('error message', () => {
  expect(() => parseBinding('a b c')).toThrowErrorMatchingInlineSnapshot(
    `"Unexpected token 'b'"`,
  );
});
