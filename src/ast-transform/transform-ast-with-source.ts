import { type ASTWithSource } from '@angular/compiler';

import { type Transformer } from './transform.ts';

export const visitASTWithSource = (
  node: ASTWithSource,
  transformer: Transformer,
) => transformer.transformChild(node.ast);
