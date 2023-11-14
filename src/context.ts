import { getCharacterIndex, getCharacterLastIndex } from './utils.js';

export class Context {
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
}

export default Context;
