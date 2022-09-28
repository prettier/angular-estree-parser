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
  | NGMicrosyntaxNode
  | NGEmptyExpression
  | NGPipeExpression
  | NGQuotedExpression
  | NGChainedExpression
);

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

/**
 *     Microsyntax ::
 *       ( ( Exp | Let ) ( Sep? ( Let | As | KeyExp ) )* Sep? Key? )?
 *
 *     Sep ::
 *       ';'
 *       ','
 *
 *     Key ::
 *       StringLiteral
 *       Identifier ( '-' Identifier )*
 *
 *     Exp ::
 *       NGNode ( 'as' Key )?
 *
 *     KeyExp ::
 *       Key ':'? Exp
 *
 *     As ::
 *       Key 'as' Key
 *
 *     Let ::
 *       'let' Key ( '=' Key )?
 */
export interface NGMicrosyntax extends NGBaseNode {
  type: 'NGMicrosyntax';
  body: (
    | NGMicrosyntaxAs
    | NGMicrosyntaxExpression
    | NGMicrosyntaxKey
    | NGMicrosyntaxKeyedExpression
    | NGMicrosyntaxLet
  )[];
}

export type NGMicrosyntaxNode =
  | NGMicrosyntax
  | NGMicrosyntaxAs
  | NGMicrosyntaxExpression
  | NGMicrosyntaxKey
  | NGMicrosyntaxKeyedExpression
  | NGMicrosyntaxLet;

export interface NGMicrosyntaxKey extends NGBaseNode {
  type: 'NGMicrosyntaxKey';
  name: string;
}

export interface NGMicrosyntaxKeyedExpression extends NGBaseNode {
  type: 'NGMicrosyntaxKeyedExpression';
  key: NGMicrosyntaxKey;
  expression: NGMicrosyntaxExpression;
}

export interface NGMicrosyntaxExpression extends NGBaseNode {
  type: 'NGMicrosyntaxExpression';
  expression: NGNode;
  alias: NGMicrosyntaxKey | null;
}

export interface NGMicrosyntaxAs extends NGBaseNode {
  type: 'NGMicrosyntaxAs';
  key: NGMicrosyntaxKey;
  alias: NGMicrosyntaxKey;
}

export interface NGMicrosyntaxLet extends NGBaseNode {
  type: 'NGMicrosyntaxLet';
  key: NGMicrosyntaxKey;
  value: NGMicrosyntaxKey | null;
}
