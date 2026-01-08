import * as angularParser from './angular-parser.ts';
import { transformAst } from './ast-transform/index.ts';
import { transformTemplateBindings } from './transform-template-binding.ts';

const createAstParser =
  (
    parse:
      | typeof angularParser.parseBinding
      | typeof angularParser.parseSimpleBinding
      | typeof angularParser.parseInterpolationExpression
      | typeof angularParser.parseAction,
  ) =>
  (text: string) => {
    const { result, comments } = parse(text);
    return Object.assign(transformAst(result), { comments });
  };

export const parseAction = createAstParser(angularParser.parseAction);
export const parseBinding = createAstParser(angularParser.parseBinding);
export const parseSimpleBinding = createAstParser(
  angularParser.parseSimpleBinding,
);
export const parseInterpolationExpression = createAstParser(
  angularParser.parseInterpolationExpression,
);
export const parseTemplateBindings = (text: string) =>
  transformTemplateBindings(
    angularParser.parseTemplateBindings(text).result.templateBindings,
    text,
  );
