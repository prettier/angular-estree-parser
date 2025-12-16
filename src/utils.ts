import type { LocationInformation, RawNGSpan } from './types.ts';

function expandSurroundingSpaces(
  { start: startIndex, end: endIndex }: RawNGSpan,
  text: string,
) {
  let start = startIndex;
  let end = endIndex;

  while (end !== text.length && /\s/.test(text[end])) {
    end++;
  }

  while (start !== 0 && /\s/.test(text[start - 1])) {
    start--;
  }

  return { start, end };
}

function getCharacterSearchTestFunction(pattern: RegExp | string) {
  if (typeof pattern === 'string') {
    return (character: string) => character === pattern;
  }

  return (character: string) => pattern.test(character);
}

export function getCharacterLastIndex(
  text: string,
  pattern: RegExp | string,
  fromIndex: number,
) {
  const test = getCharacterSearchTestFunction(pattern);

  for (let index = fromIndex; index >= 0; index--) {
    const character = text[index];

    if (test(character)) {
      return index;
    }
  }

  /* c8 ignore next 4 */
  throw new Error(
    `Cannot find front char ${pattern} from index ${fromIndex} in ${JSON.stringify(
      text,
    )}`,
  );
}

export function getCharacterIndex(
  text: string,
  pattern: RegExp | string,
  fromIndex: number,
) {
  const test = getCharacterSearchTestFunction(pattern);

  for (let index = fromIndex; index < text.length; index++) {
    const character = text[index];

    if (test(character)) {
      return index;
    }
  }

  throw new Error(
    `Cannot find character ${pattern} from index ${fromIndex} in ${JSON.stringify(
      text,
    )}`,
  );
}

export function lowercaseFirst(str: string) {
  return str.slice(0, 1).toLowerCase() + str.slice(1);
}

export function sourceSpanToLocationInformation(
  span: RawNGSpan,
): LocationInformation {
  const { start, end } = span;
  return {
    start,
    end,
    range: [start, end],
  };
}
