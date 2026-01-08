import { type Interpolation } from '@angular/compiler';

import { type Transformer } from '../transform.ts';

export const visitInterpolation = (
  node: Interpolation,
  transformer: Transformer,
) => {
  const { expressions } = node;

  /* c8 ignore next 3 @preserve */
  if (expressions.length !== 1) {
    throw new Error("Unexpected 'Interpolation'");
  }

  return transformer.transformChild(expressions[0]);
};
