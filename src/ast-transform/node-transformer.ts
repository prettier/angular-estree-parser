import { type AST, ParenthesizedExpression } from '@angular/compiler';

import {
  type IncompleteNode,
  type RawLocationInformation,
  Source,
} from '../source.ts';
import type { NGNode } from './node-types.ts';
import { transformVisitors } from './visitors.ts';

export class NodeTransformer extends Source {
  node: AST;
  ancestors: AST[];

  constructor({
    node,
    text,
    ancestors = [],
  }: {
    node: AST;
    text: string;
    ancestors?: AST[];
  }) {
    super(text);
    this.node = node;
    this.ancestors = ancestors;
  }

  create<T extends NGNode>(
    properties: IncompleteNode<T>,
    location?: RawLocationInformation,
    ancestors: AST[] = this.ancestors,
  ) {
    if (ancestors[0] instanceof ParenthesizedExpression) {
      properties.extra = {
        ...properties.extra,
        parenthesized: true,
      };
    }

    return super.createNode<T>(
      properties,
      properties.range ?? location ?? this.node,
    );
  }

  transformChild<T extends NGNode>(child: AST) {
    return new NodeTransformer({
      node: child,
      ancestors: [this.node, ...this.ancestors],
      text: this.text,
    }).transform<T>();
  }

  transformChildren<T extends NGNode>(children: AST[]) {
    return children.map((child) => this.transformChild<T>(child));
  }

  transform<T extends NGNode>() {
    const { node } = this;
    const properties = node.visit(transformVisitors, this);
    return this.create(properties, this.node) as T;
  }

  static transform(node: AST, text: string) {
    return new NodeTransformer({ node, text, ancestors: [] }).transform();
  }
}
