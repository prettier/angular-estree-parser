import * as angular from '@angular/compiler';
import type * as babel from '@babel/types';

import { Source } from './source.ts';
import type {
  LocationInformation,
  NGChainedExpression,
  NGEmptyExpression,
  NGNode,
  NGPipeExpression,
  RawNGSpan,
} from './types.ts';

function isParenthesized(node: NGNode) {
  return Boolean(node.extra?.parenthesized);
}

function isOptionalObjectOrCallee(node: NGNode): boolean {
  if (node.type === 'TSNonNullExpression' && !isParenthesized(node)) {
    return isOptionalObjectOrCallee(node.expression);
  }

  return (
    (node.type === 'OptionalCallExpression' ||
      node.type === 'OptionalMemberExpression') &&
    !isParenthesized(node)
  );
}

function isImplicitThis(node: angular.AST, text: string): boolean {
  const { start, end } = node.sourceSpan;
  return start >= end || /^\s+$/.test(text.slice(start, end));
}

type NodeTransformOptions = {
  ancestors: angular.AST[];
};

class Transformer extends Source {
  #text;

  constructor(text: string) {
    super(text);
    this.#text = text;
  }

  transform<T extends NGNode>(
    node: angular.AST,
    options?: NodeTransformOptions,
  ) {
    return this.#transform(node, options ?? { ancestors: [] }) as T &
      LocationInformation;
  }

  #create<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] } & RawNGSpan,
    ancestors: angular.AST[],
  ) {
    const node = this.createNode(properties);

    if (ancestors[0] instanceof angular.ParenthesizedExpression) {
      node.extra = {
        ...node.extra,
        parenthesized: true,
      };
    }

    return node;
  }

  #transform(node: angular.AST, options: NodeTransformOptions): NGNode {
    const ancestors = options.ancestors;
    const childTransformOptions = {
      ...options,
      ancestors: [node, ...ancestors],
    };

    if (node instanceof angular.Interpolation) {
      const { expressions } = node;

      /* c8 ignore next 3 @preserve */
      if (expressions.length !== 1) {
        throw new Error("Unexpected 'Interpolation'");
      }

      return this.transform(expressions[0], childTransformOptions);
    }

    if (node instanceof angular.Unary) {
      return this.#create<babel.UnaryExpression>(
        {
          type: 'UnaryExpression',
          prefix: true,
          argument: this.transform<babel.Expression>(node.expr),
          operator: node.operator as '-' | '+',
          ...node.sourceSpan,
        },
        ancestors,
      );
    }

    if (node instanceof angular.Binary) {
      const { operation: operator } = node;
      const [left, right] = [node.left, node.right].map((node) =>
        this.transform<babel.Expression>(node, childTransformOptions),
      );

      if (operator === '&&' || operator === '||' || operator === '??') {
        return this.#create<babel.LogicalExpression>(
          {
            type: 'LogicalExpression',
            operator: operator as babel.LogicalExpression['operator'],
            left,
            right,
            ...node.sourceSpan,
          },
          ancestors,
        );
      }

      if (angular.Binary.isAssignmentOperation(operator)) {
        return this.#create<babel.AssignmentExpression>(
          {
            type: 'AssignmentExpression',
            left: left as babel.MemberExpression,
            right,
            operator: operator as babel.AssignmentExpression['operator'],
            ...node.sourceSpan,
          },
          ancestors,
        );
      }

      return this.#create<babel.BinaryExpression>(
        {
          left,
          right,
          type: 'BinaryExpression',
          operator: operator as babel.BinaryExpression['operator'],
          ...node.sourceSpan,
        },
        ancestors,
      );
    }

    if (node instanceof angular.BindingPipe) {
      const { name } = node;
      const left = this.transform<babel.Expression>(
        node.exp,
        childTransformOptions,
      );
      const leftEnd = node.exp.sourceSpan.end;
      const rightStart = this.getCharacterIndex(
        /\S/,
        this.getCharacterIndex('|', leftEnd) + 1,
      );
      const right = this.#create<babel.Identifier>(
        {
          type: 'Identifier',
          name,
          start: rightStart,
          end: rightStart + name.length,
        },
        ancestors,
      );
      const arguments_ = node.args.map<babel.Expression>((node) =>
        this.transform(node, childTransformOptions),
      );
      return this.#create<NGPipeExpression>(
        {
          type: 'NGPipeExpression',
          left,
          right,
          arguments: arguments_,
          ...node.sourceSpan,
        },
        ancestors,
      );
    }

    if (node instanceof angular.Chain) {
      return this.#create<NGChainedExpression>(
        {
          type: 'NGChainedExpression',
          expressions: node.expressions.map<babel.Expression>((node) =>
            this.transform(node, childTransformOptions),
          ),
          ...node.sourceSpan,
        },
        ancestors,
      );
    }

    if (node instanceof angular.Conditional) {
      const [test, consequent, alternate] = [
        node.condition,
        node.trueExp,
        node.falseExp,
      ].map((node) =>
        this.transform<babel.Expression>(node, childTransformOptions),
      );

      return this.#create<babel.ConditionalExpression>(
        {
          type: 'ConditionalExpression',
          test,
          consequent,
          alternate,
          ...node.sourceSpan,
        },
        ancestors,
      );
    }

    if (node instanceof angular.EmptyExpr) {
      return this.#create<NGEmptyExpression>(
        { type: 'NGEmptyExpression', ...node.sourceSpan },
        ancestors,
      );
    }

    if (node instanceof angular.ImplicitReceiver) {
      return this.#create<babel.ThisExpression>(
        { type: 'ThisExpression', ...node.sourceSpan },
        ancestors,
      );
    }

    if (node instanceof angular.LiteralArray) {
      return this.#create<babel.ArrayExpression>(
        {
          type: 'ArrayExpression',
          elements: node.expressions.map<babel.Expression>((node) =>
            this.transform(node, childTransformOptions),
          ),
          ...node.sourceSpan,
        },
        ancestors,
      );
    }

    if (node instanceof angular.LiteralMap) {
      const { keys, values } = node;
      const tProperties = keys.map((property, index) => {
        const { key, quoted } = property;
        const { start: valueStart, end: valueEnd } = values[index].sourceSpan;

        const keyStart = this.getCharacterIndex(
          /\S/,
          index === 0
            ? node.sourceSpan.start + 1 // {
            : this.getCharacterIndex(',', values[index - 1].sourceSpan.end) + 1,
        );
        const keyEnd =
          valueStart === keyStart
            ? valueEnd
            : this.getCharacterLastIndex(
                /\S/,
                this.getCharacterLastIndex(':', valueStart - 1) - 1,
              ) + 1;
        const keySpan = { start: keyStart, end: keyEnd };
        const tKey = quoted
          ? this.#create<babel.StringLiteral>(
              {
                type: 'StringLiteral',
                value: key,
                ...keySpan,
              },
              [],
            )
          : this.#create<babel.Identifier>(
              {
                type: 'Identifier',
                name: key,
                ...keySpan,
              },
              [],
            );
        const shorthand = tKey.end < tKey.start || keyStart === valueStart;
        const value = this.transform<babel.Expression>(
          values[index],
          childTransformOptions,
        );

        return this.#create<babel.ObjectProperty>(
          {
            type: 'ObjectProperty',
            key: tKey,
            value,
            shorthand,
            computed: false,
            start: tKey.start,
            end: valueEnd,
          },
          [],
        );
      });
      return this.#create<babel.ObjectExpression>(
        {
          type: 'ObjectExpression',
          properties: tProperties,
          ...node.sourceSpan,
        },
        ancestors,
      );
    }

    if (node instanceof angular.LiteralPrimitive) {
      const { value } = node;
      switch (typeof value) {
        case 'boolean':
          return this.#create<babel.BooleanLiteral>(
            { type: 'BooleanLiteral', value, ...node.sourceSpan },
            ancestors,
          );
        case 'number':
          return this.#create<babel.NumericLiteral>(
            { type: 'NumericLiteral', value, ...node.sourceSpan },
            ancestors,
          );
        case 'object':
          return this.#create<babel.NullLiteral>(
            { type: 'NullLiteral', ...node.sourceSpan },
            ancestors,
          );
        case 'string':
          return this.#create<babel.StringLiteral>(
            { type: 'StringLiteral', value, ...node.sourceSpan },
            ancestors,
          );
        case 'undefined':
          return this.#create<babel.Identifier>(
            { type: 'Identifier', name: 'undefined', ...node.sourceSpan },
            ancestors,
          );
        /* c8 ignore next 4 */
        default:
          throw new Error(
            `Unexpected LiteralPrimitive value type ${typeof value}`,
          );
      }
    }

    if (node instanceof angular.RegularExpressionLiteral) {
      return this.#create<babel.RegExpLiteral>(
        {
          type: 'RegExpLiteral',
          pattern: node.body,
          flags: node.flags ?? '',
          ...node.sourceSpan,
        },
        ancestors,
      );
    }

    if (node instanceof angular.Call || node instanceof angular.SafeCall) {
      const arguments_ = node.args.map<babel.Expression>((node) =>
        this.transform(node, childTransformOptions),
      );
      const callee = this.transform<babel.Expression>(node.receiver);
      const isOptionalReceiver = isOptionalObjectOrCallee(callee);
      const isOptional = node instanceof angular.SafeCall;
      const nodeType =
        isOptional || isOptionalReceiver
          ? 'OptionalCallExpression'
          : 'CallExpression';
      return this.#create<babel.CallExpression | babel.OptionalCallExpression>(
        {
          type: nodeType,
          callee,
          arguments: arguments_,
          ...(nodeType === 'OptionalCallExpression'
            ? { optional: isOptional }
            : undefined),
          ...node.sourceSpan,
        },
        ancestors,
      );
    }

    if (node instanceof angular.NonNullAssert) {
      const expression = this.transform<babel.Expression>(node.expression);
      return this.#create<babel.TSNonNullExpression>(
        {
          type: 'TSNonNullExpression',
          expression: expression,
          ...node.sourceSpan,
        },
        ancestors,
      );
    }

    if (
      node instanceof angular.PrefixNot ||
      node instanceof angular.TypeofExpression ||
      node instanceof angular.VoidExpression
    ) {
      const operator =
        node instanceof angular.PrefixNot
          ? '!'
          : node instanceof angular.TypeofExpression
            ? 'typeof'
            : node instanceof angular.VoidExpression
              ? 'void'
              : /* c8 ignore next @preserve */
                undefined;

      /* c8 ignore next 3 @preserve */
      if (!operator) {
        throw new Error('Unexpected expression.');
      }

      let { start } = node.sourceSpan;

      if (operator === 'typeof' || operator === 'void') {
        const index = this.text.lastIndexOf(operator, start);

        /* c8 ignore next 7 @preserve */
        if (index === -1) {
          throw new Error(
            `Cannot find operator '${operator}' from index ${start} in ${JSON.stringify(
              this.text,
            )}`,
          );
        }

        start = index;
      }

      const expression = this.transform<babel.Expression>(node.expression);

      return this.#create<babel.UnaryExpression>(
        {
          type: 'UnaryExpression',
          prefix: true,
          operator,
          argument: expression,
          start,
          end: node.sourceSpan.end,
        },
        ancestors,
      );
    }

    if (
      node instanceof angular.KeyedRead ||
      node instanceof angular.SafeKeyedRead ||
      node instanceof angular.PropertyRead ||
      node instanceof angular.SafePropertyRead
    ) {
      const isComputed =
        node instanceof angular.KeyedRead ||
        node instanceof angular.SafeKeyedRead;
      const isOptional =
        node instanceof angular.SafeKeyedRead ||
        node instanceof angular.SafePropertyRead;

      const { receiver } = node;

      const implicit = isImplicitThis(receiver, this.#text);

      let property;
      if (isComputed) {
        property = this.transform<babel.Expression>(node.key);
      } else {
        const { name } = node;
        property = this.#create<babel.Identifier>(
          {
            type: 'Identifier',
            name,
            ...node.nameSpan,
          },
          implicit ? ancestors : [],
        );
      }

      if (implicit || receiver.sourceSpan.start === property.start) {
        return property;
      }

      const object = this.transform<babel.Expression>(receiver);
      const isOptionalObject = isOptionalObjectOrCallee(object);

      const commonProps = {
        property,
        object,
        ...node.sourceSpan,
      };

      if (isOptional || isOptionalObject) {
        return this.#create<babel.OptionalMemberExpression>(
          {
            type: 'OptionalMemberExpression',
            optional: isOptional || !isOptionalObject,
            computed: isComputed,
            ...commonProps,
          },
          ancestors,
        );
      }

      if (isComputed) {
        return this.#create<babel.MemberExpressionComputed>(
          {
            type: 'MemberExpression',
            ...commonProps,
            computed: true,
          },
          ancestors,
        );
      }

      return this.#create<babel.MemberExpressionNonComputed>(
        {
          type: 'MemberExpression',
          ...commonProps,
          computed: false,
          property: property as babel.MemberExpressionNonComputed['property'],
        },
        ancestors,
      );
    }

    if (node instanceof angular.TaggedTemplateLiteral) {
      return this.#create<babel.TaggedTemplateExpression>(
        {
          type: 'TaggedTemplateExpression',
          tag: this.transform<babel.Expression>(node.tag),
          quasi: this.transform<babel.TemplateLiteral>(node.template),
          ...node.sourceSpan,
        },
        ancestors,
      );
    }

    if (node instanceof angular.TemplateLiteral) {
      return this.#create<babel.TemplateLiteral>(
        {
          type: 'TemplateLiteral',
          quasis: node.elements.map((element) =>
            this.transform(element, childTransformOptions),
          ),
          expressions: node.expressions.map((expression) =>
            this.transform(expression, childTransformOptions),
          ),
          ...node.sourceSpan,
        },
        ancestors,
      );
    }

    if (node instanceof angular.TemplateLiteralElement) {
      const [parent] = ancestors;
      const { elements } = parent as angular.TemplateLiteral;
      const elementIndex = elements.indexOf(node);
      const isFirst = elementIndex === 0;
      const isLast = elementIndex === elements.length - 1;

      const end = node.sourceSpan.end - (isLast ? 1 : 0);
      const start = node.sourceSpan.start + (isFirst ? 1 : 0);
      const raw = this.text.slice(start, end);

      return this.#create<babel.TemplateElement>(
        {
          type: 'TemplateElement',
          value: {
            cooked: node.text,
            raw,
          },
          start: start,
          end: end,
          tail: isLast,
        },
        ancestors,
      );
    }

    if (node instanceof angular.ParenthesizedExpression) {
      return this.transform(node.expression, childTransformOptions);
    }

    /* c8 ignore next @preserve */
    throw new Error(`Unexpected node type '${node.constructor.name}'`);
  }
}

// See `convertAst` in `@angular/compiler`
type SupportedNodes =
  | angular.ASTWithSource // Not handled
  | angular.PropertyRead
  | angular.Call
  | angular.LiteralPrimitive
  | angular.Unary
  | angular.Binary
  | angular.ThisReceiver // Not handled
  | angular.KeyedRead
  | angular.Chain
  | angular.LiteralMap
  | angular.LiteralArray
  | angular.Conditional
  | angular.NonNullAssert
  | angular.BindingPipe
  | angular.SafeKeyedRead
  | angular.SafePropertyRead
  | angular.SafeCall
  | angular.EmptyExpr
  | angular.PrefixNot
  | angular.TypeofExpression
  | angular.VoidExpression
  | angular.TemplateLiteral // Including `TemplateLiteralElement`
  | angular.TaggedTemplateLiteral
  | angular.ParenthesizedExpression;
function transform(node: SupportedNodes, text: string): NGNode {
  return new Transformer(text).transform(node);
}

export { transform, Transformer };
