import type * as babel from '@babel/types';

export type Range = [number, number];
export type StartEnd = { start: number; end: number };

export type LocationInformation = StartEnd & {
  range: Range;
  extra?: any;
};

export type NGBaseNode = LocationInformation & {
  type: string;
};

export type CommentLine = babel.CommentLine & LocationInformation;

export type NGOwnNode =
  | NGEmptyExpression
  | NGPipeExpression
  | NGChainedExpression;

export type NGNode =
  | babel.Expression
  | babel.ObjectProperty
  | babel.SpreadElement
  | babel.TemplateElement
  | NGOwnNode;

export interface NGEmptyExpression extends NGBaseNode {
  type: 'NGEmptyExpression';
}

export interface NGPipeExpression extends NGBaseNode {
  type: 'NGPipeExpression';
  left: babel.Expression;
  right: babel.Identifier;
  arguments: babel.Expression[];
}

export interface NGChainedExpression extends NGBaseNode {
  type: 'NGChainedExpression';
  expressions: NGNode[];
}
