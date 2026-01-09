import { type Interpolation } from '@angular/compiler';

import { type NodeTransformer } from '../ast-transform/node-transformer.ts';

export const visitInterpolation = (
  node: Interpolation,
  transformer: NodeTransformer,
) => {
  const { expressions } = node;

  /* c8 ignore next 3 @preserve */
  if (expressions.length !== 1) {
    throw new Error("Unexpected 'Interpolation'");
  }

  return transformer.transformChild(expressions[0]);
};
