import { type AST } from '@angular/compiler';
import type * as babel from '@babel/types';

import type { NGAst, NGNodeTypes, Range, StartEnd } from './types.ts';
import {
  getCharacterIndex,
  sourceSpanToLocationInformation,
} from './utilities.ts';

export type RawLocationInformation = AST | StartEnd | Range;
export type LocationInformation = StartEnd & { range: Range };
export type IncompleteNode<Node extends { type: NGNodeTypes }> =
  Partial<Node> & { type: Node['type'] };

export class Source {
  text;

  constructor(text: string) {
    this.text = text;
  }

  getCharacterIndex(pattern: RegExp | string, index: number) {
    return getCharacterIndex(this.text, pattern, index);
  }

  transformSpan(span: StartEnd): LocationInformation {
    return sourceSpanToLocationInformation(span);
  }

  createNode<T extends NGAst>(
    properties: IncompleteNode<T>,
    location?: RawLocationInformation,
  ) {
    let start: number | undefined | null = properties.start;
    let end: number | undefined | null = properties.end;
    let range: Range | undefined = properties.range;

    if (location) {
      if (Array.isArray(location)) {
        [start, end] = location;
        range = location;
      } else {
        ({ start, end } = (location as AST).sourceSpan ?? location);
        range = [start, end];
      }
    }

    /* c8 ignore next 4 @preserve */
    if (range) {
      [start, end] = range;
    } else if (typeof start === 'number' && typeof end === 'number') {
      range = [start, end];
    }

    /* c8 ignore next 3 @preserve */
    if (!(typeof start === 'number' && typeof end === 'number' && range)) {
      throw new Error('Missing location information');
    }

    const node = {
      ...properties,
      start,
      end,
      range,
    } as T & LocationInformation;

    switch (node.type) {
      case 'NumericLiteral':
      case 'StringLiteral':
      case 'RegExpLiteral': {
        const raw = this.text.slice(start, end);
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
