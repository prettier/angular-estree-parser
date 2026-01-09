import type * as babel from '@babel/types';

export const visitThisReceiver = (): babel.ThisExpression => ({
  type: 'ThisExpression',
});
