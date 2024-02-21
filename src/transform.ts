import { transform as transformNode } from './transform-node.js';
import transformTemplateBindings from './transform-template-binding.js';
import type { ParseResult } from './types.js';
import type {
  AstParseResult,
  MicroSyntaxParseResult,
} from './angular-parser.js';

function transformAstResult({
  result: { ast: node },
  text,
  comments,
}: AstParseResult) {
  const ast = transformNode(node, text) as ParseResult;
  ast.comments = comments;
  return ast;
}

function transformMicrosyntaxResult({
  result: { templateBindings: expressions },
  text,
}: MicroSyntaxParseResult) {
  return transformTemplateBindings(expressions, text);
}

export { transformAstResult, transformMicrosyntaxResult };
