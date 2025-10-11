import { codeFrameColumns } from '@babel/code-frame';
import { wrap } from 'jest-snapshot-serializer-raw';

import type { RawNGSpan } from './types.ts';
import { fitSpans, getCharacterIndex, getCharacterLastIndex } from './utils.ts';

const text = ` ( ( ( 1 ) ) ) `;
const length = Math.floor(text.length / 2);

describe('fitSpans', () => {
  for (let i = 0; i < length; i++) {
    const start = i;
    const end = text.length - i;
    test(`start: ${start}, end: ${end}`, () => {
      const { innerSpan, outerSpan, hasParens } = fitSpans(
        { start, end },
        text,
        false,
      );
      const show = ({ start: startColumn, end: endColumn }: RawNGSpan) =>
        codeFrameColumns(text, {
          start: { line: 1, column: startColumn + 1 },
          end: { line: 1, column: endColumn + 1 },
        });
      const snapshot = [
        'origin',
        show({ start, end }),
        'inner',
        show(innerSpan),
        `outer hasParens=${hasParens}`,
        show(outerSpan),
      ].join('\n');
      expect(wrap(snapshot)).toMatchSnapshot();
    });
  }
});

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
