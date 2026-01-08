import {
  type AST,
  type ASTWithSource,
  EmptyExpr,
  ParenthesizedExpression,
} from '@angular/compiler';

import { Source } from '../source.ts';
import type { NGEmptyExpression, NGNode, RawNGSpan } from '../types.ts';
import { transformVisitor } from './visitor.ts';

class NodeTransformer extends Source {
  node: AST;
  ancestors: AST[];

  constructor({
    node,
    text,
    ancestors,
  }: {
    node: AST;
    text: string;
    ancestors: AST[];
  }) {
    super(text);
    this.node = node;
    this.ancestors = ancestors;
  }

  create<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] },
    location: AST | RawNGSpan | [number, number],
    ancestors: AST[],
  ) {
    const node = super.createNode(properties, location);

    if (ancestors[0] instanceof ParenthesizedExpression) {
      node.extra = {
        ...node.extra,
        parenthesized: true,
      };
    }

    return node;
  }

  createNode<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] },
    location: AST | RawNGSpan | [number, number] = this.node,
    ancestorsToCreate: AST[] = this.ancestors,
  ) {
    return this.create(properties, location, ancestorsToCreate);
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

  transform<T extends NGNode = NGNode>() {
    const { node } = this;
    if (node instanceof EmptyExpr) {
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

  static transform(node: AST, text: string) {
    return new NodeTransformer({ node, text, ancestors: [] }).transform();
  }
}

class AstTransformer {
  #ast;

  constructor(ast: ASTWithSource) {
    this.#ast = ast;
  }

  transform() {
    return NodeTransformer.transform(this.#ast, this.#ast.source!);
  }
}

const transformAstNode = (node: AST, text: string) => {
  return NodeTransformer.transform(node, text);
};

const transformAst = (ast: ASTWithSource) => {
  return new AstTransformer(ast).transform();
};

export {
  NodeTransformer,
  transformAst,
  transformAstNode,
  NodeTransformer as Transformer,
};
