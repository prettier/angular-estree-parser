import type { NGMicrosyntaxNode } from './microsyntax-node-types.ts';

type VisitorKeys = {
  [P in NGMicrosyntaxNode as P['type']]: (keyof P)[];
};

export const visitorKeys: VisitorKeys = {
  NGMicrosyntax: ['body'],
  NGMicrosyntaxAs: ['key', 'alias'],
  NGMicrosyntaxExpression: ['expression', 'alias'],
  NGMicrosyntaxKey: [],
  NGMicrosyntaxKeyedExpression: ['key', 'expression'],
  NGMicrosyntaxLet: ['key', 'value'],
};
