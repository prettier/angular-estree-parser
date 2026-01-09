import type { LocationInformation, StartEnd } from './types.ts';

function getCharacterSearchTestFunction(pattern: RegExp | string) {
  if (typeof pattern === 'string') {
    return (character: string) => character === pattern;
  }

  return (character: string) => pattern.test(character);
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

  /* c8 ignore next 4 @preserve */
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
  span: StartEnd,
): LocationInformation {
  const { start, end } = span;
  return {
    start,
    end,
    range: [start, end],
  };
}
