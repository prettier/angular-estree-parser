import { type ASTWithSource } from '@angular/compiler';

import { type NodeTransformer } from '../ast-transform/node-transformer.ts';

export const visitASTWithSource = (
  node: ASTWithSource,
  transformer: NodeTransformer,
) => transformer.transformChild(node.ast);
