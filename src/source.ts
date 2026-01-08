import * as angular from '@angular/compiler';
import type * as babel from '@babel/types';

import type { LocationInformation, NGNode, RawNGSpan } from './types.ts';
import { getCharacterIndex, sourceSpanToLocationInformation } from './utils.ts';

export class Source {
  text;

  constructor(text: string) {
    this.text = text;
  }

  getCharacterIndex(pattern: RegExp | string, index: number) {
    return getCharacterIndex(this.text, pattern, index);
  }

  transformSpan(span: RawNGSpan): LocationInformation {
    return sourceSpanToLocationInformation(span);
  }

  createNode<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] },
    location: angular.AST | RawNGSpan | [number, number],
  ) {
    let start: number;
    let end: number;
    let range: [number, number];
    if (Array.isArray(location)) {
      range = location;
      [start, end] = location;
    } else {
      ({ start, end } =
        location instanceof angular.AST ? location.sourceSpan : location);
      range = [start, end];
    }

    const node = {
      start,
      end,
      range,
      ...properties,
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
    }

    return node;
  }
}
