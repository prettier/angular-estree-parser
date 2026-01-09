import { type ASTWithSource } from '@angular/compiler';

import { NodeTransformer } from './node-transformer.ts';

export class AstTransformer extends NodeTransformer {
  constructor(ast: ASTWithSource) {
    super({
      node: ast,
      text: ast.source!,
    });
  }
}
