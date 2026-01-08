import type {
  AstParseResult,
  MicroSyntaxParseResult,
} from './angular-parser.ts';
import { transform as transformAst } from './ast-transform/index.ts';
import { transform as transformTemplateBindings } from './transform-template-binding.ts';

function transformAstResult({
  result: { ast },
  text,
  comments,
}: AstParseResult) {
  return Object.assign(transformAst(ast, text), { comments });
}

function transformMicrosyntaxResult({
  result: { templateBindings },
  text,
}: MicroSyntaxParseResult) {
  return transformTemplateBindings(templateBindings, text);
}

export { transformAstResult, transformMicrosyntaxResult };
