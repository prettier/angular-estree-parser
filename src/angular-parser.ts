import {
  type ASTWithSource,
  Lexer,
  Parser,
  type TemplateBindingParseResult,
} from '@angular/compiler';

import { type CommentLine } from './types.js';
import { sourceSpanToLocationInformation } from './utils.js';

const getCommentStart = (text: string): number | null =>
  // @ts-expect-error -- need to call private _commentStart
  Parser.prototype._commentStart(text);

function extractComments(text: string, shouldExtractComment: boolean) {
  const commentStart = shouldExtractComment ? getCommentStart(text) : null;

  if (commentStart === null) {
    return { text, comments: [] };
  }

  const comment: CommentLine = {
    type: 'CommentLine',
    value: text.slice(commentStart + '//'.length),
    ...sourceSpanToLocationInformation({
      start: commentStart,
      end: text.length,
    }),
  };

  return {
    text: text.slice(0, commentStart),
    comments: [comment],
  };
}

function createAngularParseFunction<
  T extends ASTWithSource | TemplateBindingParseResult,
>(parse: (text: string, parser: Parser) => T, shouldExtractComment = true) {
  return (originalText: string) => {
    const lexer = new Lexer();
    const parser = new Parser(lexer);

    const { text, comments } = extractComments(
      originalText,
      shouldExtractComment,
    );
    const result = parse(text, parser);

    if (result.errors.length !== 0) {
      const [{ message }] = result.errors;
      throw new SyntaxError(
        message.replace(/^Parser Error: | at column \d+ in [^]*$/g, ''),
      );
    }

    return { result, comments, text };
  };
}

export const parseBinding = createAngularParseFunction((text, parser) =>
  parser.parseBinding(text, '', 0),
);

export const parseSimpleBinding = createAngularParseFunction((text, parser) =>
  parser.parseSimpleBinding(text, '', 0),
);

export const parseAction = createAngularParseFunction((text, parser) =>
  parser.parseAction(text, '', 0),
);

export const parseInterpolationExpression = createAngularParseFunction(
  (text, parser) => parser.parseInterpolationExpression(text, '', 0),
);

export const parseTemplateBindings = createAngularParseFunction(
  (text, parser) => parser.parseTemplateBindings('', text, '', 0, 0),
  /* shouldExtractComment */ false,
);

export type AstParseResult = ReturnType<typeof parseBinding>;
export type MicroSyntaxParseResult = ReturnType<typeof parseTemplateBindings>;
