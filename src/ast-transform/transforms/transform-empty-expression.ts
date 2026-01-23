import type { NGEmptyExpression } from '../../types.ts';

export const visitEmptyExpr = (): Omit<
  NGEmptyExpression,
  'start' | 'end' | 'range'
> => ({ type: 'NGEmptyExpression' });
