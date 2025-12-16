import { getCharacterIndex, getCharacterLastIndex } from './utils.ts';

test('getCharacterIndex', () => {
  expect(getCharacterIndex('foobar', /o/, 0)).toBe(1);
  expect(getCharacterIndex('foobar', /o/, 1)).toBe(1);
  expect(getCharacterIndex('foobar', 'o', 0)).toBe(1);
  expect(() => getCharacterIndex('foobar', '_', 0)).toThrow();
});

test('getCharacterLastIndex', () => {
  expect(getCharacterLastIndex('foobar', /o/, 6)).toBe(2);
  expect(getCharacterLastIndex('foobar', /o/, 2)).toBe(2);
  expect(getCharacterLastIndex('foobar', 'o', 6)).toBe(2);
  expect(() => getCharacterLastIndex('foobar', '_', 6)).toThrow();
});
