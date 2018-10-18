import LineAndColumn from 'lines-and-columns';

export class Context {
  public locator = new Locator(this.text);
  constructor(public text: string) {}
}

class Locator {
  private _lineAndColumn: LineAndColumn;
  constructor(text: string) {
    this._lineAndColumn = new LineAndColumn(text);
  }
  public locationForIndex(index: number) {
    const { line, column } = this._lineAndColumn.locationForIndex(index)!;
    return { line: line + 1, column };
  }
}
