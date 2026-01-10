import { type NGBaseNode, type NGNode } from '../ast-transform/node-types.ts';

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
