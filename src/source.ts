import type { RawNGSpan, LocationInformation, NGNode } from './types.js';
import {
  getCharacterIndex,
  getCharacterLastIndex,
  sourceSpanToLocationInformation,
  fitSpans,
} from './utils.js';
import type * as b from '@babel/types';

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

  transformSpan(
    span: RawNGSpan,
    { stripSpaces = false, hasParentParens = false } = {},
  ): LocationInformation {
    if (!stripSpaces) {
      return sourceSpanToLocationInformation(span);
    }

    const { outerSpan, innerSpan, hasParens } = fitSpans(
      span,
      this.text,
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

  createNode<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] } & RawNGSpan,
    // istanbul ignore next
    { stripSpaces = true, hasParentParens = false } = {},
  ) {
    const { type, start, end } = properties;
    const node = {
      ...properties,
      ...this.transformSpan(
        { start, end },
        {
          stripSpaces,
          hasParentParens,
        },
      ),
    } as T & LocationInformation;

    switch (type) {
      case 'NumericLiteral':
      case 'StringLiteral': {
        const raw = this.text.slice(node.start, node.end);
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

export default Source;
