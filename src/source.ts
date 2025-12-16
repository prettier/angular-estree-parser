import type * as babel from '@babel/types';

import type { LocationInformation, NGNode, RawNGSpan } from './types.ts';
import {
  fitSpans,
  getCharacterIndex,
  getCharacterLastIndex,
  sourceSpanToLocationInformation,
} from './utils.ts';

export class Source {
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

  transformSpan(span: RawNGSpan): LocationInformation {
    return sourceSpanToLocationInformation(span);
  }

  createNode<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] } & RawNGSpan,
  ) {
    const node = {
      ...properties,
      range: [properties.start, properties.end],
    } as T & LocationInformation;

    switch (node.type) {
      case 'NumericLiteral':
      case 'StringLiteral':
      case 'RegExpLiteral': {
        const raw = this.text.slice(node.start, node.end);
        const { value } = node as unknown as
          | babel.NumericLiteral
          | babel.StringLiteral;
        node.extra = { ...node.extra, raw, rawValue: value };
        break;
      }
      case 'ObjectProperty': {
        const { shorthand } = node as unknown as babel.ObjectProperty;
        if (shorthand) {
          node.extra = { ...node.extra, shorthand };
        }
        break;
      }
    }

    return node;
  }
}
