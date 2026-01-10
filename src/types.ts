import { type NGNode } from './ast-transform/node-types.ts';
import { type NGMicrosyntaxNode } from './microsyntax/microsyntax-node-types.ts';

export type NGAst = NGNode | NGMicrosyntaxNode;
export type NGNodeTypes = NGAst['type'];
export type NGNodeMap = {
  [NodeType in NGNodeTypes]: Extract<NGAst, { type: NodeType }>;
};

export type * from './ast-transform/node-types.ts';
export type * from './microsyntax/microsyntax-node-types.ts';
