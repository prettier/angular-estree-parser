import { LinesAndColumns } from 'lines-and-columns';

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
}

export default Context;
