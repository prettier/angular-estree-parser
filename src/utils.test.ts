import { codeFrameColumns } from '@babel/code-frame';
import { wrap } from 'jest-snapshot-serializer-raw';
import type { RawNGSpan } from './types.js';
import { fitSpans, findBackChar, findFrontChar } from './utils.js';

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

describe('findFrontChar', () => {
  expect(findFrontChar('foobar', /o/g, 6)).toBe(2);
  expect(findFrontChar('foobar', /o/g, 2)).toBe(2);
  expect(() => findFrontChar('foobar', /_/g, 6)).toThrow();
  expect(() => findFrontChar('foobar', /o/, 6)).toThrow();
});

describe('findBackChar', () => {
  expect(findBackChar('foobar', /o/g, 0)).toBe(1);
  expect(findBackChar('foobar', /o/g, 1)).toBe(1);
  expect(() => findBackChar('foobar', /_/g, 0)).toThrow();
  expect(() => findBackChar('foobar', /o/, 0)).toThrow();
});
