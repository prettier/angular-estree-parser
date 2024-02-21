import { transformAstResult, transformMicrosyntaxResult } from './transform.js';
import * as angularParser from './angular-parser.js';

export const parseBinding = (text: string) =>
  transformAstResult(angularParser.parseBinding(text));

export const parseSimpleBinding = (text: string) =>
  transformAstResult(angularParser.parseSimpleBinding(text));

export const parseInterpolationExpression = (text: string) =>
  transformAstResult(angularParser.parseInterpolationExpression(text));

export const parseAction = (text: string) =>
  transformAstResult(angularParser.parseAction(text));

export const parseTemplateBindings = (text: string) =>
  transformMicrosyntaxResult(angularParser.parseTemplateBindings(text));
