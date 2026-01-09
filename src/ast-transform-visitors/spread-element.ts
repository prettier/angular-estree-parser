import { type SpreadElement } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type NodeTransformer } from '../ast-transform/node-transformer.ts';

export const visitSpreadElement = (
  node: SpreadElement,
  transformer: NodeTransformer,
): babel.SpreadElement => ({
  type: 'SpreadElement',
  argument: transformer.transformChild<babel.Expression>(node.expression),
});
