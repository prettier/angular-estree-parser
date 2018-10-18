import * as babelParser from '@babel/parser';

const babelParserOptions: babelParser.ParserOptions = {
  plugins: [
    'optionalChaining', // SafeMethodCall, SafePropertyRead
    'typescript', // NonNullAssert
  ],
};

export function parseBabelExpression(input: string) {
  return babelParser.parseExpression(input, babelParserOptions);
}

export function parseBabel(input: string) {
  return babelParser.parse(input, babelParserOptions);
}

export function massageAst(ast: any): any {
  if (!ast || typeof ast !== 'object') {
    return ast;
  }

  if (Array.isArray(ast)) {
    return ast.map(massageAst);
  }

  return Object.keys(ast).reduce((reduced: any, key) => {
    switch (key) {
      case 'trailingComments':
        // do nothing
        break;
      case 'extra': {
        const extra = massageAst(ast[key]);
        delete extra.parenStart;
        delete extra.parenthesized;
        if (Object.keys(extra).length !== 0) {
          reduced[key] = extra;
        }
        break;
      }
      default:
        reduced[key] = massageAst(ast[key]);
        break;
    }
    return reduced;
  }, {});
}
