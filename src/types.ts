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

export type NGOwnNode =
  | NGMicrosyntaxNode
  | NGEmptyExpression
  | NGPipeExpression
  | NGChainedExpression;

export type NGNode = babel.Node | NGOwnNode;

export type CommentLine = babel.CommentLine & LocationInformation;

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
