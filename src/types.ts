import * as ng from '@angular/compiler/src/expression_parser/ast';
import * as b from '@babel/types';

export interface NGBaseNode {
  type: string;
  start: number;
  end: number;
  loc: b.SourceLocation;
}

export type NGNode = { comments?: b.CommentLine[] } & (
  | b.Node
  | NGEmptyExpression
  | NGPipeExpression
  | NGQuotedExpression
  | NGChainedExpression);

export interface NGEmptyExpression extends NGBaseNode {
  type: 'NGEmptyExpression';
}

export interface NGPipeExpression extends NGBaseNode {
  type: 'NGPipeExpression';
  left: b.Expression;
  right: b.Identifier;
  arguments: b.Expression[];
}

export interface NGQuotedExpression extends NGBaseNode {
  type: 'NGQuotedExpression';
  prefix: string;
  value: string;
}

export interface NGChainedExpression extends NGBaseNode {
  type: 'NGChainedExpression';
  expressions: NGNode[];
}

export interface RawNGComment {
  type: 'Comment';
  value: string;
  span: RawNGSpan;
}

export interface RawNGSpan {
  start: number;
  end: number;
}
