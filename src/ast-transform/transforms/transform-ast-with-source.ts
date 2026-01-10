import { type ASTWithSource } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type NodeTransformer } from '../node-transformer.ts';

export const visitASTWithSource = (
  node: ASTWithSource,
  transformer: NodeTransformer,
) => transformer.transformChild<babel.Expression>(node.ast);
