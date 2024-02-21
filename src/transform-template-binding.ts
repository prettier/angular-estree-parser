import type * as ng from '@angular/compiler';
import {
  ExpressionBinding as NGExpressionBinding,
  VariableBinding as NGVariableBinding,
} from '@angular/compiler';
import { Context } from './context.js';
import {transform as transformNode} from './transform-node.js';
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
import { toLowerCamelCase, transformSpan, createNode } from './utils.js';

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

/**
 * - "a"  (start=0 end=1) -> (start=0 end=3)
 * - '\'' (start=0 end=1) -> (start=0 end=4)
 */
function fixSpan(span: RawNGSpan, text: string) {
  if (text[span.start] !== '"' && text[span.start] !== "'") {
    return;
  }
  const quote = text[span.start];
  let hasBackSlash = false;
  for (let i = span.start + 1; i < text.length; i++) {
    switch (text[i]) {
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
  context: Context,
): ng.VariableBinding['value'] {
  if (!variableBinding.value || variableBinding.value.source) {
    return variableBinding.value;
  }

  const index = context.getCharacterIndex(
    /\S/,
    variableBinding.sourceSpan.start,
  );
  return {
    source: '$implicit',
    span: { start: index, end: index },
  };
}



class Transformer extends Context {
  #rawTemplateBindings
  #text

  constructor(rawTemplateBindings: ng.TemplateBinding[], text: string) {
    super(text);
    this.#rawTemplateBindings = rawTemplateBindings
    this.#text = text;
  }

  static transform(rawTemplateBindings: ng.TemplateBinding[], text: string) {
    return new Transformer(rawTemplateBindings, text).expressions;
  }

  get expressions() {
    return this.#transformTemplateBindings();
  }


#transformTemplateBindings(
): NGMicrosyntax {
  const rawTemplateBindings = this.#rawTemplateBindings
  const context = this

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
      const alias = _c<NGMicrosyntaxKey>({
        type: 'NGMicrosyntaxKey',
        name: templateBinding.key.source,
        ...templateBinding.key.span,
      });
      const updateSpanEnd = <T extends NGNode>(node: T, end: number): T => ({
        ...node,
        ...transformSpan({ start: node.start!, end }, context.text),
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

  return _c<NGMicrosyntax>({
    type: 'NGMicrosyntax',
    body,
    ...(body.length === 0
      ? rawTemplateBindings[0].sourceSpan
      : { start: body[0].start, end: body.at(-1)!.end }),
  });

  function transformTemplateBinding(
    templateBinding: ng.TemplateBinding,
    index: number,
  ): Exclude<NGMicrosyntaxNode, NGMicrosyntax> {
    if (isExpressionBinding(templateBinding)) {
      const { key, value } = templateBinding;
      if (!value) {
        return _c<NGMicrosyntaxKey>({
          type: 'NGMicrosyntaxKey',
          name: removePrefix(key.source),
          ...key.span,
        });
      } else if (index === 0) {
        return _c<NGMicrosyntaxExpression>({
          type: 'NGMicrosyntaxExpression',
          expression: _t<NGNode>(value.ast),
          alias: null,
          ...value.sourceSpan,
        });
      } else {
        return _c<NGMicrosyntaxKeyedExpression>({
          type: 'NGMicrosyntaxKeyedExpression',
          key: _c<NGMicrosyntaxKey>({
            type: 'NGMicrosyntaxKey',
            name: removePrefix(key.source),
            ...key.span,
          }),
          expression: _c<NGMicrosyntaxExpression>({
            type: 'NGMicrosyntaxExpression',
            expression: _t<NGNode>(value.ast),
            alias: null,
            ...value.sourceSpan,
          }),
          start: key.span.start,
          end: value.sourceSpan.end,
        });
      }
    } else {
      const { key, sourceSpan } = templateBinding;
      const startsWithLet = /^let\s$/.test(
        context.text.slice(sourceSpan.start, sourceSpan.start + 4),
      );
      if (startsWithLet) {
        const { value } = templateBinding;
        return _c<NGMicrosyntaxLet>({
          type: 'NGMicrosyntaxLet',
          key: _c<NGMicrosyntaxKey>({
            type: 'NGMicrosyntaxKey',
            name: key.source,
            ...key.span,
          }),
          value: !value
            ? null
            : _c<NGMicrosyntaxKey>({
                type: 'NGMicrosyntaxKey',
                name: value.source,
                ...value.span,
              }),
          start: sourceSpan.start,
          end: value ? value.span.end : key.span.end,
        });
      } else {
        const value = getAsVariableBindingValue(templateBinding, context);
        return _c<NGMicrosyntaxAs>({
          type: 'NGMicrosyntaxAs',
          key: _c<NGMicrosyntaxKey>({
            type: 'NGMicrosyntaxKey',
            name: value!.source,
            ...value!.span,
          }),
          alias: _c<NGMicrosyntaxKey>({
            type: 'NGMicrosyntaxKey',
            name: key.source,
            ...key.span,
          }),
          start: value!.span.start,
          end: key.span.end,
        });
      }
    }
  }

  function _t<T extends NGNode>(node: ng.AST) {
    return transformNode(node, context.text) as T;
  }

  function _c<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] } & RawNGSpan,
    { stripSpaces = true } = {},
  ) {
    return createNode<T>(context, properties, { stripSpaces });
  }

  function removePrefix(string: string) {
    return toLowerCamelCase(string.slice(prefix.source.length));
  }

  function fixTemplateBindingSpan(templateBinding: ng.TemplateBinding) {
    fixSpan(templateBinding.key.span, context.text);
    if (isVariableBinding(templateBinding) && templateBinding.value) {
      fixSpan(templateBinding.value.span, context.text);
    }
  }
}
}

function transform(
  rawTemplateBindings: ng.TemplateBinding[],
  text: string,
) {
  return Transformer.transform(rawTemplateBindings, text);
}

export default transform;
