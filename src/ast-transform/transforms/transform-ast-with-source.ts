import { type ASTWithSource } from '@angular/compiler';

import type { NGNode } from '../../types.ts';
import { type NodeTransformer } from '../node-transformer.ts';

export const visitASTWithSource = (
  node: ASTWithSource,
  transformer: NodeTransformer,
) => transformer.transformChild<NGNode>(node.ast);
