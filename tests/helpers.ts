import { codeFrameColumns } from '@babel/code-frame';
import * as babelParser from '@babel/parser';
import { wrap } from 'jest-snapshot-serializer-raw';
import * as prettier from 'prettier';

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
        // we added a custom `parenEnd` field for positioning
        delete extra.parenEnd;
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

export function snapshotAst(ast: any, source: string) {
  const snapshots: string[] = [];
  const isNode = (x: any) => x && x.type;
  visitAst(ast, (node) => {
    const props = Object.keys(node).reduce((reduced: any, key) => {
      const value = node[key];
      switch (key) {
        case 'type':
        case 'loc':
        case 'start':
        case 'end':
          break;
        default:
          reduced[key] =
            Array.isArray(value) && value.some(isNode)
              ? value.map((x) => x.type)
              : isNode(value)
              ? value.type
              : value;
          break;
      }
      return reduced;
    }, {});
    const fixColumn = (p: { line: number; column: number }) => ({
      line: p.line,
      column: p.column + 1,
    });
    const codeframe = codeFrameColumns(source, {
      start: fixColumn(node.loc.start),
      end: fixColumn(node.loc.end),
    });
    const propsString = prettier.format(JSON.stringify(props), {
      parser: 'json5',
    });
    snapshots.push(`${node.type} ${propsString}${codeframe}`);
  });

  return wrap(snapshots.join(`\n${'-'.repeat(80)}\n`));
}

function visitAst(ast: any, fn: (node: any) => void) {
  if (!ast || typeof ast !== 'object') {
    return;
  }

  if (Array.isArray(ast)) {
    ast.forEach((value) => visitAst(value, fn));
    return;
  }

  if (ast.type) {
    fn(ast);
  }

  Object.keys(ast).forEach((key) => visitAst(ast[key], fn));
}
