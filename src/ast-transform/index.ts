import { type AST, type ASTWithSource } from '@angular/compiler';

import { AstTransformer } from './ast-transformer.ts';
import { NodeTransformer } from './node-transformer.ts';

export const transformAstNode = (node: AST, text: string) => {
  return NodeTransformer.transform(node, text);
};

export const transformAst = (ast: ASTWithSource) => {
  return new AstTransformer(ast).transform();
};
