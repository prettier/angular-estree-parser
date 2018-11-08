import * as ng from '@angular/compiler/src/expression_parser/ast';
import { Context } from './context';
import { InputNode, OutputNode, transform, transformSpan } from './transform';
import {
  NGMicrosyntax,
  NGMicrosyntaxAs,
  NGMicrosyntaxExpression,
  NGMicrosyntaxKey,
  NGMicrosyntaxKeyedExpression,
  NGMicrosyntaxLet,
  NGMicrosyntaxNode,
  NGNode,
  RawNGSpan,
} from './types';
import { findBackChar, toLowerCamelCase } from './utils';

export function transformTemplateBindings(
  rawTemplateBindings: ng.TemplateBinding[],
  context: Context,
): NGMicrosyntax {
  const [firstTemplateBinding] = rawTemplateBindings;
  const { key: prefix } = firstTemplateBinding;
  const templateBindings =
    context.text
      .slice(firstTemplateBinding.span.start, firstTemplateBinding.span.end)
      .trim().length === 0
      ? rawTemplateBindings.slice(1)
      : rawTemplateBindings;

  const body: NGMicrosyntax['body'] = [];

  let lastTemplateBinding: ng.TemplateBinding | null = null;
  for (let i = 0; i < templateBindings.length; i++) {
    const templateBinding = templateBindings[i];
    const { key, keyIsVar, name, span } = templateBinding;

    if (
      lastTemplateBinding &&
      lastTemplateBinding.key === name &&
      keyIsVar &&
      /^as\s$/.test(context.text.slice(span.start, span.start + 3))
    ) {
      const keyStart = findBackChar(/\S/, span.start + 3, context.text);
      const keySpan = findBackKeySpan(keyStart, key);
      const alias = _c<NGMicrosyntaxKey>(
        'NGMicrosyntaxKey',
        { name: key },
        keySpan,
      );
      const updateSpanEnd = <T extends NGNode>(node: T, end: number): T => ({
        // @ts-ignore
        ...node,
        ...transformSpan({ start: node.start!, end }, context),
      });
      const updateExpressionAlias = (expression: NGMicrosyntaxExpression) => ({
        ...updateSpanEnd(expression, alias.end),
        alias,
      });

      const lastNode = body.pop()!;
      // istanbul ignore else
      if (lastNode.type === 'NGMicrosyntaxExpression') {
        body.push(updateExpressionAlias(lastNode));
      } else if (lastNode.type === 'NGMicrosyntaxKeyedExpression') {
        const expression = updateExpressionAlias(lastNode.expression);
        body.push(updateSpanEnd({ ...lastNode, expression }, expression.end));
      } else {
        throw new Error(`Unexpected type ${lastNode.type}`);
      }
    } else {
      body.push(transformTemplateBinding(templateBinding, i));
    }

    lastTemplateBinding = templateBinding;
  }

  return _c<NGMicrosyntax>(
    'NGMicrosyntax',
    { body },
    body.length === 0
      ? rawTemplateBindings[0].span
      : { start: body[0].start, end: body[body.length - 1].end },
  );

  function transformTemplateBinding(
    { key, keyIsVar, name, expression, span }: ng.TemplateBinding,
    index: number,
  ): Exclude<NGMicrosyntaxNode, NGMicrosyntax> {
    if (!keyIsVar) {
      if (!expression) {
        return _c<NGMicrosyntaxKey>(
          'NGMicrosyntaxKey',
          { name: removePrefix(key) },
          span,
        );
      } else if (index === 0) {
        return _c<NGMicrosyntaxExpression>(
          'NGMicrosyntaxExpression',
          { expression: _t<NGNode>(expression.ast), alias: null },
          span,
        );
      } else {
        const ngExpression = _t<NGNode>(expression.ast);
        const { start, end } = ngExpression;
        const keyName = removePrefix(key);
        return _c<NGMicrosyntaxKeyedExpression>(
          'NGMicrosyntaxKeyedExpression',
          {
            key: _c<NGMicrosyntaxKey>(
              'NGMicrosyntaxKey',
              { name: keyName },
              findBackKeySpan(span.start, keyName),
            ),
            expression: _c<NGMicrosyntaxExpression>(
              'NGMicrosyntaxExpression',
              { expression: ngExpression, alias: null },
              { start, end },
            ),
          },
          span,
        );
      }
    } else {
      if (/^let\s$/.test(context.text.slice(span.start, span.start + 4))) {
        const keyStart = findBackChar(/\S/, span.start + 4, context.text);
        const keySpan = findBackKeySpan(keyStart, key);
        return _c<NGMicrosyntaxLet>(
          'NGMicrosyntaxLet',
          {
            key: _c<NGMicrosyntaxKey>(
              'NGMicrosyntaxKey',
              { name: key },
              keySpan,
            ),
            value:
              context.text.slice(keySpan.end, span.end).trim().length === 0
                ? null
                : _c<NGMicrosyntaxKey>(
                    'NGMicrosyntaxKey',
                    { name },
                    {
                      start: findBackChar(/=/, keySpan.end, context.text) + 1,
                      end: span.end,
                    },
                  ),
          },
          span,
        );
      } else {
        const keySpan = findBackKeySpan(span.start, name);
        return _c<NGMicrosyntaxAs>(
          'NGMicrosyntaxAs',
          {
            key: _c<NGMicrosyntaxKey>('NGMicrosyntaxKey', { name }, keySpan),
            alias: _c<NGMicrosyntaxKey>(
              'NGMicrosyntaxKey',
              { name: key },
              {
                start:
                  findBackChar(/\S/, keySpan.end, context.text) + 'as'.length,
                end: span.end,
              },
            ),
          },
          span,
        );
      }
    }
  }

  function _t<T extends OutputNode>(n: InputNode) {
    return transform(n, context) as T & RawNGSpan;
  }

  function _c<T extends OutputNode>(
    t: T['type'],
    n: Partial<T>,
    span: RawNGSpan,
    stripSpaces: boolean = true,
  ): T & RawNGSpan {
    return {
      type: t,
      ...transformSpan(span, context, stripSpaces, false),
      // @ts-ignore
      ...n,
    };
  }

  function findBackKeySpan(start: number, key: string): RawNGSpan {
    if (context.text[start] !== "'" && context.text[start] !== '"') {
      return { start, end: start + key.length };
    }
    const quote = context.text[start];
    let backslash = 0;
    let index = start + 1;
    while (true) {
      const char = context.text[index];
      if (char === quote && backslash % 2 === 0) {
        return { start, end: index + 1 };
      }
      if (char === '\\') {
        backslash++;
      } else {
        backslash = 0;
      }
      index++;
    }
  }

  function removePrefix(string: string) {
    return toLowerCamelCase(string.slice(prefix.length));
  }
}
