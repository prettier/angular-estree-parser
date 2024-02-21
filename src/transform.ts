import Context from './context.js';
import transformNode from './transform-node.js';
import transformTemplateBindings from './transform-template-binding.js';
import type { ParseResult } from './types.js';
import type {
  AstParseResult,
  MicroSyntaxParseResult,
} from './angular-parser.ts';

function transformAstResult({
  result: { ast: node },
  textToParse,
  comments,
}: AstParseResult) {
  const context = new Context(textToParse);
  const ast = transformNode(node, context) as ParseResult;
  ast.comments = comments;
  return ast;
}

function transformMicrosyntaxResult({
  result: { templateBindings: expressions },
  textToParse,
}: MicroSyntaxParseResult) {
  const context = new Context(textToParse);
  return transformTemplateBindings(expressions, context);
}

export { transformAstResult, transformMicrosyntaxResult };
