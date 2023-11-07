import type * as ng from '@angular/compiler';
import {
  ExpressionBinding as NGExpressionBinding,
  VariableBinding as NGVariableBinding,
} from '@angular/compiler';
import { type Context } from './context.js';
import {
  type InputNode,
  type OutputNode,
  transform,
  transformSpan,
} from './transform.js';
import type {
  NGMicrosyntax,
  NGMicrosyntaxAs,
  NGMicrosyntaxExpression,
  NGMicrosyntaxKey,
  NGMicrosyntaxKeyedExpression,
  NGMicrosyntaxLet,
  NGMicrosyntaxNode,
  NGNode,
  RawNGSpan,
} from './types.js';
import {
  findBackChar,
  NG_PARSE_TEMPLATE_BINDINGS_FAKE_PREFIX,
  toLowerCamelCase,
} from './utils.js';

export function transformTemplateBindings(
  rawTemplateBindings: ng.TemplateBinding[],
  context: Context,
): NGMicrosyntax {
  rawTemplateBindings.forEach(fixTemplateBindingSpan);

  const [firstTemplateBinding] = rawTemplateBindings;
  const { key: prefix } = firstTemplateBinding;
  const templateBindings =
    context.text
      .slice(
        firstTemplateBinding.sourceSpan.start,
        firstTemplateBinding.sourceSpan.end,
      )
      .trim().length === 0
      ? rawTemplateBindings.slice(1)
      : rawTemplateBindings;

  const body: NGMicrosyntax['body'] = [];

  let lastTemplateBinding: ng.TemplateBinding | null = null;
  for (let i = 0; i < templateBindings.length; i++) {
    const templateBinding = templateBindings[i];

    if (
      lastTemplateBinding &&
      isExpressionBinding(lastTemplateBinding) &&
      isVariableBinding(templateBinding) &&
      templateBinding.value &&
      templateBinding.value.source === lastTemplateBinding.key.source
    ) {
      const alias = _c<NGMicrosyntaxKey>(
        'NGMicrosyntaxKey',
        { name: templateBinding.key.source },
        templateBinding.key.span,
      );
      const updateSpanEnd = <T extends NGNode>(node: T, end: number): T => ({
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
      ? rawTemplateBindings[0].sourceSpan
      : { start: body[0].start, end: body.at(-1)!.end },
  );

  function transformTemplateBinding(
    templateBinding: ng.TemplateBinding,
    index: number,
  ): Exclude<NGMicrosyntaxNode, NGMicrosyntax> {
    if (isExpressionBinding(templateBinding)) {
      const { key, value } = templateBinding;
      if (!value) {
        return _c<NGMicrosyntaxKey>(
          'NGMicrosyntaxKey',
          { name: removePrefix(key.source) },
          key.span,
        );
      } else if (index === 0) {
        return _c<NGMicrosyntaxExpression>(
          'NGMicrosyntaxExpression',
          { expression: _t<NGNode>(value.ast), alias: null },
          value.sourceSpan,
        );
      } else {
        return _c<NGMicrosyntaxKeyedExpression>(
          'NGMicrosyntaxKeyedExpression',
          {
            key: _c<NGMicrosyntaxKey>(
              'NGMicrosyntaxKey',
              { name: removePrefix(key.source) },
              key.span,
            ),
            expression: _c<NGMicrosyntaxExpression>(
              'NGMicrosyntaxExpression',
              { expression: _t<NGNode>(value.ast), alias: null },
              value.sourceSpan,
            ),
          },
          { start: key.span.start, end: value.sourceSpan.end },
        );
      }
    } else {
      const { key, sourceSpan } = templateBinding;
      const startsWithLet = /^let\s$/.test(
        context.text.slice(sourceSpan.start, sourceSpan.start + 4),
      );
      if (startsWithLet) {
        const { value } = templateBinding;
        return _c<NGMicrosyntaxLet>(
          'NGMicrosyntaxLet',
          {
            key: _c<NGMicrosyntaxKey>(
              'NGMicrosyntaxKey',
              { name: key.source },
              key.span,
            ),
            value: !value
              ? null
              : _c<NGMicrosyntaxKey>(
                  'NGMicrosyntaxKey',
                  { name: value.source },
                  value.span,
                ),
          },
          {
            start: sourceSpan.start,
            end: value ? value.span.end : key.span.end,
          },
        );
      } else {
        const value = getAsVariableBindingValue(templateBinding);
        return _c<NGMicrosyntaxAs>(
          'NGMicrosyntaxAs',
          {
            key: _c<NGMicrosyntaxKey>(
              'NGMicrosyntaxKey',
              { name: value!.source },
              value!.span,
            ),
            alias: _c<NGMicrosyntaxKey>(
              'NGMicrosyntaxKey',
              { name: key.source },
              key.span,
            ),
          },
          { start: value!.span.start, end: key.span.end },
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
    stripSpaces = true,
  ) {
    return {
      type: t,
      ...transformSpan(span, context, stripSpaces),
      ...n,
    } as T & RawNGSpan;
  }

  function removePrefix(string: string) {
    return toLowerCamelCase(string.slice(prefix.source.length));
  }

  function isExpressionBinding(
    templateBinding: ng.TemplateBinding,
  ): templateBinding is ng.ExpressionBinding {
    return templateBinding instanceof NGExpressionBinding;
  }

  function isVariableBinding(
    templateBinding: ng.TemplateBinding,
  ): templateBinding is ng.VariableBinding {
    return templateBinding instanceof NGVariableBinding;
  }

  function fixTemplateBindingSpan(templateBinding: ng.TemplateBinding) {
    fixSpan(templateBinding.key.span);
    if (isVariableBinding(templateBinding) && templateBinding.value) {
      fixSpan(templateBinding.value.span);
    }
  }

  /**
   * - "a"  (start=0 end=1) -> (start=0 end=3)
   * - '\'' (start=0 end=1) -> (start=0 end=4)
   */
  function fixSpan(span: RawNGSpan) {
    if (context.text[span.start] !== '"' && context.text[span.start] !== "'") {
      return;
    }
    const quote = context.text[span.start];
    let hasBackSlash = false;
    for (let i = span.start + 1; i < context.text.length; i++) {
      switch (context.text[i]) {
        case quote:
          if (!hasBackSlash) {
            span.end = i + 1;
            return;
          }
        // fall through
        default:
          hasBackSlash = false;
          break;
        case '\\':
          hasBackSlash = !hasBackSlash;
          break;
      }
    }
  }

  /**
   * - "as b" (value="NgEstreeParser" key="b") -> (value="$implicit" key="b")
   */
  function getAsVariableBindingValue(
    variableBinding: ng.VariableBinding,
  ): ng.VariableBinding['value'] {
    if (
      !variableBinding.value ||
      variableBinding.value.source !== NG_PARSE_TEMPLATE_BINDINGS_FAKE_PREFIX
    ) {
      return variableBinding.value;
    }

    const index = findBackChar(
      /\S/,
      variableBinding.sourceSpan.start,
      context.text,
    );
    return {
      source: '$implicit',
      span: { start: index, end: index },
    };
  }
}
