import type { NGOwnNode } from './node-types.ts';

export type VisitorKeys<T extends NGOwnNode> = {
  [P in T as P['type']]: (keyof P)[];
};

export const visitorKeys: VisitorKeys<NGOwnNode> = {
  NGChainedExpression: ['expressions'],
  NGEmptyExpression: [],
  NGPipeExpression: ['left', 'right', 'arguments'],
};
