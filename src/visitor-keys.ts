import type { NGOwnNode } from './types.ts';

type VisitorKeys = {
  [P in NGOwnNode as P['type']]: (keyof P)[];
};

export const visitorKeys: VisitorKeys = {
  NGChainedExpression: ['expressions'],
  NGEmptyExpression: [],
  NGPipeExpression: ['left', 'right', 'arguments'],
  NGMicrosyntax: ['body'],
  NGMicrosyntaxAs: ['key', 'alias'],
  NGMicrosyntaxExpression: ['expression', 'alias'],
  NGMicrosyntaxKey: [],
  NGMicrosyntaxKeyedExpression: ['key', 'expression'],
  NGMicrosyntaxLet: ['key', 'value'],
};
