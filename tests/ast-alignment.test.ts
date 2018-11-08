import { parseBinding } from '../src/index';
import { massageAst, parseBabelExpression } from './helpers';

enum ParseType {
  Binding = 1 << 0,
}

describe.each([
  [
    ParseType.Binding,
    `{
      'btn-success': (dialog$ || async).level === dialogLevelEnum.SUCCESS,
      'btn-warning': (dialog$ || async).level === dialogLevelEnum.WARNING,
      'btn-svg': (dialog$ || async).level === dialogLevelEnum.DANGER
    }`,
  ],
  [ParseType.Binding, 'onSave($event)'],
])('', (parseType: ParseType, input: string) => {
  if (parseType & ParseType.Binding) {
    test(`${ParseType[ParseType.Binding]}: ${JSON.stringify(input)}`, () => {
      expect(massageAst(parseBinding(input))).toEqual(
        massageAst(parseBabelExpression(input)),
      );
    });
  }
});
