import type {
  AstParseResult,
  MicroSyntaxParseResult,
} from './angular-parser.ts';
import { transform as transformNode } from './transform-ast.ts';
import { transform as transformTemplateBindings } from './transform-template-binding.ts';

function transformAstResult({
  result: { ast },
  text,
  comments,
}: AstParseResult) {
  try {
    return Object.assign(transformNode(ast, text), { comments });
  } catch {
    console.log({
      ast,
      es: transformNode(ast, text),
    });
  }
}

function transformMicrosyntaxResult({
  result: { templateBindings },
  text,
}: MicroSyntaxParseResult) {
  return transformTemplateBindings(templateBindings, text);
}

export { transformAstResult, transformMicrosyntaxResult };
