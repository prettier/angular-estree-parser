import * as angular from '@angular/compiler';

import { Source } from './source.ts';
import { transformVisitor } from './transforms/visitor.ts';
import type { NGEmptyExpression, NGNode, RawNGSpan } from './types.ts';

class Transformer extends Source {
  node: angular.AST;
  ancestors: angular.AST[];

  constructor({
    node,
    text,
    ancestors,
  }: {
    node: angular.AST;
    text: string;
    ancestors: angular.AST[];
  }) {
    super(text);
    this.node = node;
    this.ancestors = ancestors;
  }

  create<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] },
    location: angular.AST | RawNGSpan | [number, number],
    ancestors: angular.AST[],
  ) {
    const node = super.createNode(properties, location);

    if (ancestors[0] instanceof angular.ParenthesizedExpression) {
      node.extra = {
        ...node.extra,
        parenthesized: true,
      };
    }

    return node;
  }

  createNode<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] },
    location: angular.AST | RawNGSpan | [number, number] = this.node,
    ancestorsToCreate: angular.AST[] = this.ancestors,
  ) {
    return this.create(properties, location, ancestorsToCreate);
  }

  transformChild<T extends NGNode>(child: angular.AST) {
    return new Transformer({
      node: child,
      ancestors: [this.node, ...this.ancestors],
      text: this.text,
    }).transform<T>();
  }

  transformChildren<T extends NGNode>(children: angular.AST[]) {
    return children.map((child) => this.transformChild<T>(child));
  }

  transform<T extends NGNode = NGNode>() {
    const { node } = this;
    if (node instanceof angular.EmptyExpr) {
      return this.createNode<NGEmptyExpression>(
        { type: 'NGEmptyExpression' },
        node.sourceSpan,
      ) as T;
    }

    const properties = node.visit(transformVisitor, this);

    if (properties.range) {
      properties.start ??= properties.range[0];
      properties.end ??= properties.range[1];
      return properties as T;
    }

    const { location = node.sourceSpan, ...restProperties } = properties;
    const estreeNode = this.createNode(restProperties, location);

    return estreeNode as T;
  }

  static transform(node: angular.AST, text: string) {
    return new Transformer({ node, text, ancestors: [] }).transform();
  }
}

const transform = (node: angular.AST, text: string) => {
  return Transformer.transform(node, text);
};

export { transform, Transformer };
