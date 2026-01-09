import { type BindingPipe } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type NodeTransformer } from '../ast-transform/node-transformer.ts';
import { type IncompleteNode } from '../source.ts';
import type { NGPipeExpression } from '../types.ts';

export const visitPipe = (
  node: BindingPipe,
  transformer: NodeTransformer,
): IncompleteNode<NGPipeExpression> => ({
  type: 'NGPipeExpression',
  left: transformer.transformChild<babel.Expression>(node.exp),
  right: transformer.create<babel.Identifier>(
    { type: 'Identifier', name: node.name },
    node.nameSpan,
  ),
  arguments: transformer.transformChildren<babel.Expression>(node.args),
});
