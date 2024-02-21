import type { RawNGSpan, LocationInformation, NGNode } from './types.js';
import { getCharacterIndex, getCharacterLastIndex, transformSpan } from './utils.js';
import type * as b from '@babel/types';


export class Context {
  text;

  constructor(text: string) {
    this.text = text;
  }

  getCharacterIndex(pattern: RegExp | string, index: number) {
    return getCharacterIndex(this.text, pattern, index);
  }

  getCharacterLastIndex(pattern: RegExp | string, index: number) {
    return getCharacterLastIndex(this.text, pattern, index);
  }

  createNode<T extends NGNode>(
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
}

export default Context;
