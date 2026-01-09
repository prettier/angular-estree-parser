import { type SpreadElement } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type Transformer } from './transform.ts';

export const visitSpreadElement = (
  node: SpreadElement,
  transformer: Transformer,
): babel.SpreadElement => ({
  type: 'SpreadElement',
  argument: transformer.transformChild(node.expression),
});
