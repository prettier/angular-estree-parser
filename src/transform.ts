import { transform as transformNode } from './transform-node.js';
import { transform as transformTemplateBindings } from './transform-template-binding.js';
import type {
  AstParseResult,
  MicroSyntaxParseResult,
} from './angular-parser.js';

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
