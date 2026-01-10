import {
  type TaggedTemplateLiteral,
  type TemplateLiteral,
  type TemplateLiteralElement,
} from '@angular/compiler';
import type * as babel from '@babel/types';

import { type NodeTransformer } from '../node-transformer.ts';

export const visitTaggedTemplateLiteral = (
  node: TaggedTemplateLiteral,
  transformer: NodeTransformer,
) =>
  transformer.create<babel.TaggedTemplateExpression>({
    type: 'TaggedTemplateExpression',
    tag: transformer.transformChild<babel.Expression>(node.tag),
    quasi: transformer.transformChild<babel.TemplateLiteral>(node.template),
  });

export const visitTemplateLiteral = (
  node: TemplateLiteral,
  transformer: NodeTransformer,
) =>
  transformer.create<babel.TemplateLiteral>({
    type: 'TemplateLiteral',
    quasis: transformer.transformChildren<babel.TemplateElement>(node.elements),
    expressions: transformer.transformChildren<babel.Expression>(
      node.expressions,
    ),
  });

export const visitTemplateLiteralElement = (
  node: TemplateLiteralElement,
  transformer: NodeTransformer,
) => {
  const [parent] = transformer.ancestors;
  const { elements } = parent as TemplateLiteral;
  const elementIndex = elements.indexOf(node);
  const isFirst = elementIndex === 0;
  const isLast = elementIndex === elements.length - 1;

  const end = node.sourceSpan.end - (isLast ? 1 : 0);
  const start = node.sourceSpan.start + (isFirst ? 1 : 0);
  const raw = transformer.text.slice(start, end);

  return {
    type: 'TemplateElement',
    value: { cooked: node.text, raw },
    tail: isLast,
    range: [start, end],
  };
};
