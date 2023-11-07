import { LinesAndColumns } from 'lines-and-columns';
import { getCharacterIndex, getCharacterLastIndex } from './utils.js';

export class Context {
  text;
  #linesAndColumns!: LinesAndColumns;

  constructor(text: string) {
    this.text = text;
  }

  locationForIndex(index: number) {
    this.#linesAndColumns ??= new LinesAndColumns(this.text);
    const { line, column } = this.#linesAndColumns.locationForIndex(index)!;
    return { line: line + 1, column, index };
  }

  getCharacterIndex(pattern: RegExp | string, index: number) {
    return getCharacterIndex(this.text, pattern, index);
  }

  getCharacterLastIndex(pattern: RegExp | string, index: number) {
    return getCharacterLastIndex(this.text, pattern, index);
  }
}

export default Context;
