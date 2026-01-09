import { type BindingPipe } from '@angular/compiler';
import type * as babel from '@babel/types';

import type { NGPipeExpression } from '../types.ts';
import { type NodeTransformer } from '../ast-transform/node-transformer.ts';

export const visitPipe = (
  node: BindingPipe,
  transformer: NodeTransformer,
): Omit<NGPipeExpression, 'start' | 'end' | 'range'> => ({
  type: 'NGPipeExpression',
  left: transformer.transformChild<babel.Expression>(node.exp),
  right: transformer.createNode<babel.Identifier>(
    { type: 'Identifier', name: node.name },
    node.nameSpan,
  ),
  arguments: transformer.transformChildren<babel.Expression>(node.args),
});
