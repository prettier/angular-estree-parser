import type * as ng from '@angular/compiler';
import {
  ExpressionBinding as NGExpressionBinding,
  VariableBinding as NGVariableBinding,
} from '@angular/compiler';
import { Source } from './source.js';
import { transform as transformNode } from './transform-node.js';
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
import { lowercaseFirst } from './utils.js';

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

class Transformer extends Source {
  #rawTemplateBindings;
  #text;

  constructor(rawTemplateBindings: ng.TemplateBinding[], text: string) {
    super(text);
    this.#rawTemplateBindings = rawTemplateBindings;
    this.#text = text;

    for (const expression of rawTemplateBindings) {
      this.#fixTemplateBindingSpan(expression);
    }
  }

  get expressions() {
    return this.#transformTemplateBindings();
  }

  get #prefix() {
    return this.#rawTemplateBindings[0].key;
  }

  #create<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] } & RawNGSpan,
    { stripSpaces = true } = {},
  ) {
    return this.createNode<T>(properties, { stripSpaces });
  }

  #transform<T extends NGNode>(node: ng.AST) {
    return transformNode(node, this.#text) as T;
  }

  #removePrefix(string: string) {
    return lowercaseFirst(string.slice(this.#prefix.source.length));
  }

  /**
   * - "a"  (start=0 end=1) -> (start=0 end=3)
   * - '\'' (start=0 end=1) -> (start=0 end=4)
   */
  #fixSpan(span: RawNGSpan) {
    const text = this.#text;
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

  #fixTemplateBindingSpan(templateBinding: ng.TemplateBinding) {
    this.#fixSpan(templateBinding.key.span);

    if (isVariableBinding(templateBinding) && templateBinding.value) {
      this.#fixSpan(templateBinding.value.span);
    }
  }

  /**
   * - "as b" (value="NgEstreeParser" key="b") -> (value="$implicit" key="b")
   */
  #getAsVariableBindingValue(
    variableBinding: ng.VariableBinding,
  ): ng.VariableBinding['value'] {
    if (!variableBinding.value || variableBinding.value.source) {
      return variableBinding.value;
    }

    const index = this.getCharacterIndex(
      /\S/,
      variableBinding.sourceSpan.start,
    );

    return {
      source: '$implicit',
      span: { start: index, end: index },
    };
  }

  #transformTemplateBindings(): NGMicrosyntax {
    const rawTemplateBindings = this.#rawTemplateBindings;

    const [firstTemplateBinding] = rawTemplateBindings;
    const templateBindings =
      this.#text
        .slice(
          firstTemplateBinding.sourceSpan.start,
          firstTemplateBinding.sourceSpan.end,
        )
        .trim().length === 0
        ? rawTemplateBindings.slice(1)
        : rawTemplateBindings;

    const body: NGMicrosyntax['body'] = [];

    let lastTemplateBinding: ng.TemplateBinding | null = null;
    for (const [index, templateBinding] of templateBindings.entries()) {
      if (
        lastTemplateBinding &&
        isExpressionBinding(lastTemplateBinding) &&
        isVariableBinding(templateBinding) &&
        templateBinding.value &&
        templateBinding.value.source === lastTemplateBinding.key.source
      ) {
        const alias = this.#create<NGMicrosyntaxKey>({
          type: 'NGMicrosyntaxKey',
          name: templateBinding.key.source,
          ...templateBinding.key.span,
        });
        const updateSpanEnd = <T extends NGNode>(node: T, end: number): T => ({
          ...node,
          ...this.transformSpan({ start: node.start!, end }),
        });
        const updateExpressionAlias = (
          expression: NGMicrosyntaxExpression,
        ) => ({
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
        body.push(this.#transformTemplateBinding(templateBinding, index));
      }

      lastTemplateBinding = templateBinding;
    }

    return this.#create<NGMicrosyntax>({
      type: 'NGMicrosyntax',
      body,
      ...(body.length === 0
        ? rawTemplateBindings[0].sourceSpan
        : { start: body[0].start, end: body.at(-1)!.end }),
    });
  }

  #transformTemplateBinding(
    templateBinding: ng.TemplateBinding,
    index: number,
  ): Exclude<NGMicrosyntaxNode, NGMicrosyntax> {
    if (isExpressionBinding(templateBinding)) {
      const { key, value } = templateBinding;
      if (!value) {
        return this.#create<NGMicrosyntaxKey>({
          type: 'NGMicrosyntaxKey',
          name: this.#removePrefix(key.source),
          ...key.span,
        });
      } else if (index === 0) {
        return this.#create<NGMicrosyntaxExpression>({
          type: 'NGMicrosyntaxExpression',
          expression: this.#transform<NGNode>(value.ast),
          alias: null,
          ...value.sourceSpan,
        });
      } else {
        return this.#create<NGMicrosyntaxKeyedExpression>({
          type: 'NGMicrosyntaxKeyedExpression',
          key: this.#create<NGMicrosyntaxKey>({
            type: 'NGMicrosyntaxKey',
            name: this.#removePrefix(key.source),
            ...key.span,
          }),
          expression: this.#create<NGMicrosyntaxExpression>({
            type: 'NGMicrosyntaxExpression',
            expression: this.#transform<NGNode>(value.ast),
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
        this.#text.slice(sourceSpan.start, sourceSpan.start + 4),
      );
      if (startsWithLet) {
        const { value } = templateBinding;
        return this.#create<NGMicrosyntaxLet>({
          type: 'NGMicrosyntaxLet',
          key: this.#create<NGMicrosyntaxKey>({
            type: 'NGMicrosyntaxKey',
            name: key.source,
            ...key.span,
          }),
          value: !value
            ? null
            : this.#create<NGMicrosyntaxKey>({
                type: 'NGMicrosyntaxKey',
                name: value.source,
                ...value.span,
              }),
          start: sourceSpan.start,
          end: value ? value.span.end : key.span.end,
        });
      } else {
        const value = this.#getAsVariableBindingValue(templateBinding);
        return this.#create<NGMicrosyntaxAs>({
          type: 'NGMicrosyntaxAs',
          key: this.#create<NGMicrosyntaxKey>({
            type: 'NGMicrosyntaxKey',
            name: value!.source,
            ...value!.span,
          }),
          alias: this.#create<NGMicrosyntaxKey>({
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
}

function transform(rawTemplateBindings: ng.TemplateBinding[], text: string) {
  return new Transformer(rawTemplateBindings, text).expressions;
}

export { transform };
