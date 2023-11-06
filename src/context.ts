// @ts-expect-error -- Can't work
import { LinesAndColumns } from 'lines-and-columns';

export class Context {
  text;
  locator;
  constructor(text: string) {
    this.text = text;
    this.locator = new Locator(this.text);
  }
}

class Locator {
  private _linesAndColumns: LinesAndColumns;
  constructor(text: string) {
    this._linesAndColumns = new LinesAndColumns(text);
  }
  public locationForIndex(index: number) {
    const { line, column } = this._linesAndColumns.locationForIndex(index)! as {
      line: number;
      column: number;
    };
    return { line: line + 1, column, index };
  }
}
