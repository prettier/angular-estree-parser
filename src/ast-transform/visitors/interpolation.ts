import { type Interpolation } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type NodeTransformer } from '../node-transformer.ts';

export const visitInterpolation = (
  node: Interpolation,
  transformer: NodeTransformer,
) => {
  const { expressions } = node;

  /* c8 ignore next 3 @preserve */
  if (expressions.length !== 1) {
    throw new Error("Unexpected 'Interpolation'");
  }

  return transformer.transformChild<babel.Expression>(expressions[0]);
};
