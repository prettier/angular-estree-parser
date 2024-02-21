import { codeFrameColumns } from '@babel/code-frame';
import * as babelParser from '@babel/parser';
import { LinesAndColumns } from 'lines-and-columns';
import { wrap } from 'jest-snapshot-serializer-raw';
import type * as angular from '@angular/compiler';
import type * as babel from '@babel/types';

const babelParserOptions: babelParser.ParserOptions = {
  plugins: [
    'typescript', // NonNullAssert
  ],
  ranges: true,
};

function fixBabelCommentsRange(
  ast: (
    | ReturnType<typeof babelParser.parse>
    | ReturnType<typeof babelParser.parseExpression>
  ) & { comments?: babel.Comment[] | null },
) {
  // https://github.com/babel/babel/issues/15115
  for (const comment of ast.comments!) {
    // @ts-expect-error -- missing types
    comment.range ??= [comment.start, comment.end];
  }

  return ast;
}

export function parseBabelExpression(input: string) {
  return fixBabelCommentsRange(
    babelParser.parseExpression(input, babelParserOptions),
  );
}

export function parseBabel(input: string) {
  return fixBabelCommentsRange(babelParser.parse(input, babelParserOptions));
}

export function massageAst(ast: any): any {
  if (!ast || typeof ast !== 'object') {
    return ast;
  }

  if (Array.isArray(ast)) {
    return ast.map(massageAst);
  }

  // Not exists in types, but exists in node.
  if (ast.type === 'ObjectProperty') {
    if (ast.method !== undefined && ast.method !== false) {
      throw new Error(
        `Unexpected "method: ${ast.method}" in "ObjectProperty".`,
      );
    }
    delete ast.method;
  }

  delete ast.loc;

  const massaged = Object.keys(ast).reduce((reduced: any, key) => {
    switch (key) {
      case 'trailingComments':
        // do nothing
        break;
      case 'extra': {
        const extra = massageAst(ast[key]);
        if (extra) {
          // we added a custom `parenEnd` field for positioning
          delete extra.parenEnd;
          if (Object.keys(extra).length !== 0) {
            reduced[key] = extra;
          }
        }
        break;
      }
      default:
        reduced[key] = massageAst(ast[key]);
        break;
    }
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

const KNOWN_AST_TYPES = [
  'ASTWithSource',
  'Unary',
  'Binary',
  'BindingPipe',
  'Call',
  'Chain',
  'Conditional',
  'EmptyExpr',
  'ImplicitReceiver',
  'KeyedRead',
  'SafeKeyedRead',
  'KeyedWrite',
  'LiteralArray',
  'LiteralMap',
  'LiteralPrimitive',
  'NonNullAssert',
  'PrefixNot',
  'PropertyRead',
  'PropertyWrite',
  'SafeCall',
  'SafePropertyRead',
  'ThisReceiver',
  'Interpolation',
] as const;

export function getAngularNodeType(node: angular.AST) {
  return (
    KNOWN_AST_TYPES.find((type) => node instanceof ng[type]) ??
    node.constructor.name
  );
}
