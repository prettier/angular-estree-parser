import { getCharacterIndex } from '../src/utilities.ts';

test('getCharacterIndex', () => {
  expect(getCharacterIndex('foobar', /o/, 0)).toBe(1);
  expect(getCharacterIndex('foobar', /o/, 1)).toBe(1);
  expect(getCharacterIndex('foobar', 'o', 0)).toBe(1);
  expect(() => getCharacterIndex('foobar', '_', 0)).toThrow();
});
