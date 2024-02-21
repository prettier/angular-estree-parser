
import type {
  RawNGSpan,
  LocationInformation,
  NGNode,
} from './types.js';
import type * as b from '@babel/types';
import type Context from './context.js';

function stripSurroundingSpaces(
  { start: startIndex, end: endIndex }: RawNGSpan,
  text: string,
) {
  let start = startIndex;
  let end = endIndex;

  while (end !== start && /\s/.test(text[end - 1])) {
    end--;
  }

  while (start !== end && /\s/.test(text[start])) {
    start++;
  }

  return { start, end };
}

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

function expandSurroundingParens(span: RawNGSpan, text: string) {
  return text[span.start - 1] === '(' && text[span.end] === ')'
    ? { start: span.start - 1, end: span.end + 1 }
    : span;
}

export function fitSpans(
  span: RawNGSpan,
  text: string,
  hasParentParens: boolean,
): { outerSpan: RawNGSpan; innerSpan: RawNGSpan; hasParens: boolean } {
  let parensCount = 0;

  const outerSpan = { start: span.start, end: span.end };

  while (true) {
    const spacesExpandedSpan = expandSurroundingSpaces(outerSpan, text);
    const parensExpandedSpan = expandSurroundingParens(
      spacesExpandedSpan,
      text,
    );

    if (
      spacesExpandedSpan.start === parensExpandedSpan.start &&
      spacesExpandedSpan.end === parensExpandedSpan.end
    ) {
      break;
    }

    outerSpan.start = parensExpandedSpan.start;
    outerSpan.end = parensExpandedSpan.end;

    parensCount++;
  }

  return {
    hasParens: (hasParentParens ? parensCount - 1 : parensCount) !== 0,
    outerSpan: stripSurroundingSpaces(
      hasParentParens
        ? { start: outerSpan.start + 1, end: outerSpan.end - 1 }
        : outerSpan,
      text,
    ),
    innerSpan: stripSurroundingSpaces(span, text),
  };
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

export function toLowerCamelCase(str: string) {
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

export function transformSpan(
  span: RawNGSpan,
  text: string,
  { stripSpaces = false, hasParentParens = false } = {},
): LocationInformation {
  if (!stripSpaces) {
    return sourceSpanToLocationInformation(span);
  }

  const { outerSpan, innerSpan, hasParens } = fitSpans(
    span,
    text,
    hasParentParens,
  );
  const locationInformation = sourceSpanToLocationInformation(innerSpan);
  if (hasParens) {
    locationInformation.extra = {
      parenthesized: true,
      parenStart: outerSpan.start,
      parenEnd: outerSpan.end,
    };
  }

  return locationInformation;
}

export function createNode<T extends NGNode>(
  context: Context,
  properties: Partial<T> & { type: T['type'] } & RawNGSpan,
  // istanbul ignore next
  { stripSpaces = true, hasParentParens = false } = {},
) {
  const { type, start, end } = properties;
  const node = {
    ...properties,
    ...transformSpan({ start, end }, context.text, {
      stripSpaces,
      hasParentParens,
    }),
  } as T & LocationInformation;

  switch (type) {
    case 'NumericLiteral':
    case 'StringLiteral': {
      const raw = context.text.slice(node.start, node.end);
      const { value } = node as unknown as b.NumericLiteral | b.StringLiteral;
      node.extra = { ...node.extra, raw, rawValue: value };
      break;
    }
    case 'ObjectProperty': {
      const { shorthand } = node as unknown as b.ObjectProperty;
      if (shorthand) {
        node.extra = { ...node.extra, shorthand };
      }
      break;
    }
  }

  return node;
}
