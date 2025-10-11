import type {
  AstParseResult,
  MicroSyntaxParseResult,
} from './angular-parser.ts';
import { transform as transformNode } from './transform-node.ts';
import { transform as transformTemplateBindings } from './transform-template-binding.ts';

function transformAstResult({
  result: { ast },
  text,
  comments,
}: AstParseResult) {
  return Object.assign(transformNode(ast, text), { comments });
}

function transformMicrosyntaxResult({
  result: { templateBindings },
  text,
}: MicroSyntaxParseResult) {
  return transformTemplateBindings(templateBindings, text);
}

export { transformAstResult, transformMicrosyntaxResult };
