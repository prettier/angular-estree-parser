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

  getCharacterIndex(regex: RegExp, index: number) {
    return getCharacterIndex(this.text, regex, index);
  }

  getCharacterLastIndex(regex: RegExp, index: number) {
    return getCharacterLastIndex(this.text, regex, index);
  }
}

export default Context;
