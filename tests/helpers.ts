import * as angular from '@angular/compiler';
import { codeFrameColumns } from '@babel/code-frame';
import * as babel from '@babel/parser';
import { wrap } from 'jest-snapshot-serializer-raw';
import { LinesAndColumns } from 'lines-and-columns';

const babelParseOptions: babel.ParserOptions = {
  plugins: [
    'typescript', // NonNullAssert
  ],
  ranges: true,
  attachComment: false,
};

export const parseBabelExpression = (input: string) => {
  const ast = babel.parseExpression(input, babelParseOptions);

  // https://github.com/babel/babel/issues/15115
  for (const comment of ast.comments!) {
    // @ts-expect-error -- Missing ranges
    comment.range ??= [comment.start, comment.end];
  }

  return ast;
};

export function massageAst(ast: any, parser: 'babel' | 'angular'): any {
  if (!ast || typeof ast !== 'object') {
    return ast;
  }

  if (Array.isArray(ast)) {
    return ast.map((node) => massageAst(node, parser));
  }

  // We don't provide these
  if (parser === 'babel') {
    if (typeof ast.extra?.parenStart === 'number') {
      delete ast.extra.parenStart;
    }

    delete ast.loc;
  }

  const massaged = Object.keys(ast).reduce((reduced: any, key) => {
    reduced[key] = massageAst(ast[key], parser);
    return reduced;
  }, {});

  if (Array.isArray(massaged.errors) && massaged.errors.length === 0) {
    delete massaged.errors;
  }

  return massaged;
}

export function snapshotAst(ast: any, source: string) {
  const snapshots: string[] = [];
  const isNode = (x: any) => x && x.type;
  const linesAndColumns = new LinesAndColumns(source);
  visitAst(ast, (node) => {
    const props = Object.keys(node).reduce((reduced: any, key) => {
      const value = node[key];
      switch (key) {
        case 'type':
        case 'range':
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
      line: p.line + 1,
      column: p.column + 1,
    });
    const [start, end] = [node.start, node.end].map((index) =>
      fixColumn(linesAndColumns.locationForIndex(index)!),
    );
    const codeFrame = codeFrameColumns(source, { start, end });
    const propsString = JSON.stringify(props, undefined, 2);
    snapshots.push(`${node.type} ${propsString}\n${codeFrame}`);
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

export function getAngularNodeType(node: angular.AST) {
  while (node instanceof angular.ParenthesizedExpression) {
    node = node.expression;
  }

  return node.constructor.name;
}
