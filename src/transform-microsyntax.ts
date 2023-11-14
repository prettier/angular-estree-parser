import * as ng from '@angular/compiler';
import type * as b from '@babel/types';
import {
  ExpressionBinding as NGExpressionBinding,
  VariableBinding as NGVariableBinding,
} from '@angular/compiler';
import { type Context } from './context.js';
import transformNode from './transform-node.js';
import type {
  NGMicrosyntax,
  NGMicrosyntaxAsExpression,
  NGMicrosyntaxKeyedExpression,
  NGNode,
  RawNGSpan,
  NGMicrosyntaxOfExpression,
} from './types.js';
import { NG_PARSE_TEMPLATE_BINDINGS_FAKE_PREFIX } from './parser.js';
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
  if (
    !variableBinding.value ||
    variableBinding.value.source !== NG_PARSE_TEMPLATE_BINDINGS_FAKE_PREFIX
  ) {
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

function transformTemplateBindings({
  expressions: rawTemplateBindings,
  context,
}: {
  expressions: ng.TemplateBinding[];
  context: Context;
}): NGMicrosyntax {
  rawTemplateBindings.forEach(fixTemplateBindingSpan);

  function transformVariableBinding(variableBinding: ng.VariableBinding) {
    const { key, sourceSpan } = variableBinding;
    const startsWithLet = /^let\s$/.test(
      context.text.slice(sourceSpan.start, sourceSpan.start + 4),
    );
    if (startsWithLet) {
      const { value } = variableBinding;
      const id = _c<b.Identifier>({
        type: 'Identifier',
        name: key.source,
        ...key.span,
      });
      const init = value
        ? _c<b.Identifier>({
            type: 'Identifier',
            name: value.source,
            ...value.span,
          })
        : null;
      return _c<b.VariableDeclaration>({
        type: 'VariableDeclaration',
        kind: 'let',
        declarations: [
          _c<b.VariableDeclarator>({
            type: 'VariableDeclarator',
            id,
            init,
            ...sourceSpan,
          }),
        ],
        ...sourceSpan,
      });
    } else {
      const value = getAsVariableBindingValue(variableBinding, context);
      return _c<NGMicrosyntaxAsExpression>({
        type: 'NGMicrosyntaxAsExpression',
        expression: _c<b.Identifier>({
          type: 'Identifier',
          name: value!.source,
          ...value!.span,
        }),
        alias: _c<b.Identifier>({
          type: 'Identifier',
          name: key.source,
          ...key.span,
        }),
        start: value!.span.start,
        end: key.span.end,
      });
    }
  }

  function transformExpressionBinding(expressionBinding: ng.ExpressionBinding) {
    const { key, value } = expressionBinding;

    if (!value) {
      return transformTemplateBindingIdentifier(key);
    }

    const hasKey = key.source !== '';

    if (hasKey) {
      return _c<NGMicrosyntaxKeyedExpression>({
        type: 'NGMicrosyntaxKeyedExpression',
        key: transformTemplateBindingIdentifier(key),
        expression: _t(value),
        ...expressionBinding.sourceSpan,
      });
    }

    return _t<NGNode>(value);
  }

  function transformTemplateBinding(templateBinding: ng.TemplateBinding) {
    if (isExpressionBinding(templateBinding)) {
      return transformExpressionBinding(templateBinding);
    }
    if (isVariableBinding(templateBinding)) {
      return transformVariableBinding(templateBinding);
    }

    throw new Error('Unexpected node');
  }

  const [firstTemplateBinding] = rawTemplateBindings;
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

  function isOfExpression(node: ng.TemplateBinding) {
    return (
      isExpressionBinding(node) &&
      node.key.source === 'Of' &&
      node.value instanceof ng.ASTWithSource
    );
  }

  function transformOfExpression(
    first: ng.TemplateBinding,
    second: ng.ExpressionBinding,
  ) {
    const left = transformTemplateBinding(
      first,
    ) as NGMicrosyntaxOfExpression['left'];
    const right = _t(second.value!) as NGMicrosyntaxOfExpression['right'];

    return _c<NGMicrosyntaxOfExpression>({
      type: 'NGMicrosyntaxOfExpression',
      left,
      right,
      start: left.start,
      end: left.end,
    });
  }

  function isAsExpression(
    first: ng.TemplateBinding,
    second: ng.TemplateBinding,
  ) {
    return (
      isExpressionBinding(first) &&
      first.key.source === '' &&
      first.value instanceof ng.ASTWithSource &&
      isVariableBinding(second) &&
      context.text.slice(first.value.span.end, second.key.span.start).trim() ==
        'as'
    );
  }

  function transformAsExpression(
    first: ng.ExpressionBinding,
    second: ng.VariableBinding,
  ) {
    return _c<NGMicrosyntaxAsExpression>({
      type: 'NGMicrosyntaxAsExpression',
      expression: _t(first.value as ng.ASTWithSource),
      alias: _c<b.Identifier>({
        type: 'Identifier',
        name: second.key.source,
        ...second.key.span,
      }),
      start: first.sourceSpan.start,
      end: second.sourceSpan.end,
    });
  }

  for (let i = 0; i < templateBindings.length; i++) {
    const templateBinding = templateBindings[i];
    const nextTemplateBinding = templateBindings[i + 1];
    if (isOfExpression(nextTemplateBinding)) {
      const ofExpression = transformOfExpression(
        templateBinding,
        nextTemplateBinding as ng.ExpressionBinding,
      );

      body.push(ofExpression);
      i++;
      continue;
    }

    if (isAsExpression(templateBinding, nextTemplateBinding)) {
      const asExpression = transformAsExpression(
        templateBinding as ng.ExpressionBinding,
        nextTemplateBinding as ng.VariableBinding,
      );
      body.push(asExpression);
      i++;
      continue;
    }

    body.push(transformTemplateBinding(templateBinding));
  }

  return _c<NGMicrosyntax>({
    type: 'NGMicrosyntax',
    body,
    start: 0,
    end: context.text.length,
  });

  function _t<T extends NGNode>(node: ng.AST) {
    return transformNode(node, context) as T;
  }

  function _c<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] } & RawNGSpan,
    { stripSpaces = true } = {},
  ) {
    return createNode<T>(context, properties, { stripSpaces });
  }

  function removePrefix(string: string) {
    return toLowerCamelCase(string);
  }

  function fixTemplateBindingSpan(templateBinding: ng.TemplateBinding) {
    fixSpan(templateBinding.key.span, context.text);
    if (isVariableBinding(templateBinding) && templateBinding.value) {
      fixSpan(templateBinding.value.span, context.text);
    }
  }

  function transformTemplateBindingIdentifier(
    node: ng.TemplateBindingIdentifier,
  ) {
    return _c<b.Identifier>({
      type: 'Identifier',
      name: node.source,
      ...node.span,
    });
  }
}

export { transformTemplateBindings };
