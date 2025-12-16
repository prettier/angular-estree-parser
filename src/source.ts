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

  transformSpan(
    span: RawNGSpan,
    { stripSpaces = false, isInParentParens = false } = {},
  ): LocationInformation {
    if (!stripSpaces) {
      return sourceSpanToLocationInformation(span);
    }

    const { outerSpan, innerSpan, hasParens } = fitSpans(
      span,
      this.text,
      isInParentParens,
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
    { stripSpaces = true, isInParentParens = false } = {},
  ) {
    const { type, start, end } = properties;
    const node = {
      ...properties,
      ...this.transformSpan(
        { start, end },
        {
          stripSpaces,
          isInParentParens,
        },
      ),
    } as T & LocationInformation;

    switch (type) {
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
