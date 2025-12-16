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
function getOuterStart(node: NGNode): number {
  return isParenthesized(node) ? node.extra.parenStart : node.start!;
}
function getOuterEnd(node: NGNode): number {
  return isParenthesized(node) ? node.extra.parenEnd : node.end!;
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
  isInParentParens?: boolean;
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
    { stripSpaces = true, isInParentParens = false } = {},
  ) {
    return this.createNode<T>(properties, { stripSpaces, isInParentParens });
  }

  #transformReceiverAndName(
    node:
      | angular.KeyedRead
      | angular.SafeKeyedRead
      | angular.PropertyRead
      | angular.SafePropertyRead,
    property: babel.Expression,
    ancestors: angular.AST[],
    {
      computed,
      optional,
      isInParentParens = false,
    }: {
      computed: boolean;
      optional: boolean;
      isInParentParens?: boolean;
    },
  ) {
    const { receiver } = node;
    if (
      isImplicitThis(receiver, this.#text) ||
      receiver.sourceSpan.start === property.start
    ) {
      return property;
    }
    const object = this.transform<babel.Expression>(receiver);
    const isOptionalObject = isOptionalObjectOrCallee(object);

    const commonProps = {
      property,
      object,
      computed,
      ...node.sourceSpan,
    };

    if (optional || isOptionalObject) {
      return this.#create<babel.OptionalMemberExpression>(
        {
          type: 'OptionalMemberExpression',
          optional: optional || !isOptionalObject,
          ...commonProps,
        },
        ancestors,
        { isInParentParens },
      );
    }

    if (computed) {
      return this.#create<babel.MemberExpressionComputed>(
        {
          type: 'MemberExpression',
          ...commonProps,
          computed: true,
        },
        ancestors,
        { isInParentParens },
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
      { isInParentParens },
    );
  }

  #transform(node: angular.AST, options: NodeTransformOptions): NGNode {
    const ancestors = options.ancestors;
    const childTransformOptions = {
      ...options,
      ancestors: [...ancestors, node],
    };

    const { isInParentParens } = {
      isInParentParens: false,
      ...options,
    };

    if (node instanceof angular.Interpolation) {
      const { expressions } = node;

      /* c8 ignore next 3 */
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
        { isInParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.Binary) {
      const {
        left: originalLeft,
        operation: operator,
        right: originalRight,
      } = node;
      const left = this.transform<babel.Expression>(
        originalLeft,
        childTransformOptions,
      );
      const right = this.transform<babel.Expression>(
        originalRight,
        childTransformOptions,
      );
      const start = getOuterStart(left);
      const end = getOuterEnd(right);
      const properties = { left, right, start, end };

      if (operator === '&&' || operator === '||' || operator === '??') {
        return this.#create<babel.LogicalExpression>(
          {
            ...properties,
            type: 'LogicalExpression',
            operator: operator as babel.LogicalExpression['operator'],
          },
          ancestors,
          { isInParentParens: isInParentParens },
        );
      }

      if (angular.Binary.isAssignmentOperation(operator)) {
        return this.#create<babel.AssignmentExpression>(
          {
            ...properties,
            type: 'AssignmentExpression',
            left: left as babel.MemberExpression,
            operator: operator as babel.AssignmentExpression['operator'],
            ...node.sourceSpan,
          },
          ancestors,
          { isInParentParens: isInParentParens },
        );
      }

      return this.#create<babel.BinaryExpression>(
        {
          ...properties,
          type: 'BinaryExpression',
          operator: operator as babel.BinaryExpression['operator'],
        },
        ancestors,
        { isInParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.BindingPipe) {
      const { exp: expressionNode, name, args: originalArguments } = node;
      const left = this.transform<babel.Expression>(
        expressionNode,
        childTransformOptions,
      );
      const start = getOuterStart(left);
      const leftEnd = getOuterEnd(left);
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
      const argumentNodes = originalArguments.map<babel.Expression>((node) =>
        this.transform(node, childTransformOptions),
      );
      return this.#create<NGPipeExpression>(
        {
          type: 'NGPipeExpression',
          left,
          right,
          arguments: argumentNodes,
          start,
          end: getOuterEnd(
            // TODO[@fisker]: End seems not correct, since there should be `()`
            argumentNodes.length === 0 ? right : argumentNodes.at(-1)!,
          ),
        },
        ancestors,
        { isInParentParens: isInParentParens },
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
        { isInParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.Conditional) {
      const { condition, trueExp, falseExp } = node;
      const test = this.transform<babel.Expression>(
        condition,
        childTransformOptions,
      );
      const consequent = this.transform<babel.Expression>(
        trueExp,
        childTransformOptions,
      );
      const alternate = this.transform<babel.Expression>(
        falseExp,
        childTransformOptions,
      );
      return this.#create<babel.ConditionalExpression>(
        {
          type: 'ConditionalExpression',
          test,
          consequent,
          alternate,
          start: getOuterStart(test),
          end: getOuterEnd(alternate),
        },
        ancestors,
        { isInParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.EmptyExpr) {
      return this.#create<NGEmptyExpression>(
        { type: 'NGEmptyExpression', ...node.sourceSpan },
        ancestors,
        { isInParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.ImplicitReceiver) {
      return this.#create<babel.ThisExpression>(
        { type: 'ThisExpression', ...node.sourceSpan },
        ancestors,
        { isInParentParens: isInParentParens },
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
        { isInParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.LiteralMap) {
      const { keys, values } = node;
      const tValues = values.map((value) =>
        this.transform<babel.Expression>(value),
      );
      const tProperties = keys.map(({ key, quoted }, index) => {
        const tValue = tValues[index];
        const valueStart = getOuterStart(tValue);
        const valueEnd = getOuterEnd(tValue);

        const keyStart = this.getCharacterIndex(
          /\S/,
          index === 0
            ? node.sourceSpan.start + 1 // {
            : this.getCharacterIndex(',', getOuterEnd(tValues[index - 1])) + 1,
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
              ancestors,
            )
          : this.#create<babel.Identifier>(
              {
                type: 'Identifier',
                name: key,
                ...keySpan,
              },
              ancestors,
            );
        const shorthand = tKey.end < tKey.start || keyStart === valueStart;

        return this.#create<babel.ObjectProperty>(
          {
            type: 'ObjectProperty',
            key: tKey,
            value: tValue,
            shorthand,
            computed: false,
            start: getOuterStart(tKey),
            end: valueEnd,
          },
          ancestors,
        );
      });
      return this.#create<babel.ObjectExpression>(
        {
          type: 'ObjectExpression',
          properties: tProperties,
          ...node.sourceSpan,
        },
        ancestors,
        { isInParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.LiteralPrimitive) {
      const { value } = node;
      switch (typeof value) {
        case 'boolean':
          return this.#create<babel.BooleanLiteral>(
            { type: 'BooleanLiteral', value, ...node.sourceSpan },
            ancestors,
            { isInParentParens: isInParentParens },
          );
        case 'number':
          return this.#create<babel.NumericLiteral>(
            { type: 'NumericLiteral', value, ...node.sourceSpan },
            ancestors,
            { isInParentParens: isInParentParens },
          );
        case 'object':
          return this.#create<babel.NullLiteral>(
            { type: 'NullLiteral', ...node.sourceSpan },
            ancestors,
            { isInParentParens: isInParentParens },
          );
        case 'string':
          return this.#create<babel.StringLiteral>(
            { type: 'StringLiteral', value, ...node.sourceSpan },
            ancestors,
            { isInParentParens: isInParentParens },
          );
        case 'undefined':
          return this.#create<babel.Identifier>(
            { type: 'Identifier', name: 'undefined', ...node.sourceSpan },
            ancestors,
            { isInParentParens: isInParentParens },
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
        { isInParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.Call || node instanceof angular.SafeCall) {
      const isOptionalType = node instanceof angular.SafeCall;
      const { receiver, args } = node;
      const tArgs =
        args.length === 1
          ? [
              this.transform<babel.Expression>(args[0], {
                ...childTransformOptions,
                isInParentParens: true,
              }),
            ]
          : (args as angular.AST[]).map<babel.Expression>((node) =>
              this.transform(node, childTransformOptions),
            );
      const tReceiver = this.transform<babel.Expression>(receiver!);
      const isOptionalReceiver = isOptionalObjectOrCallee(tReceiver);
      const nodeType =
        isOptionalType || isOptionalReceiver
          ? 'OptionalCallExpression'
          : 'CallExpression';
      return this.#create<babel.CallExpression | babel.OptionalCallExpression>(
        {
          type: nodeType,
          callee: tReceiver,
          arguments: tArgs,
          ...(nodeType === 'OptionalCallExpression'
            ? { optional: isOptionalType }
            : undefined),
          start: getOuterStart(tReceiver),
          end: node.sourceSpan.end, // `)`
        },
        ancestors,
        { isInParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.NonNullAssert) {
      const expression = this.transform<babel.Expression>(node.expression);
      return this.#create<babel.TSNonNullExpression>(
        {
          type: 'TSNonNullExpression',
          expression: expression,
          start: getOuterStart(expression),
          end: node.sourceSpan.end, // `!`
        },
        ancestors,
        { isInParentParens: isInParentParens },
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
              : /* c8 ignore next */
                undefined;

      /* c8 ignore next 3 */
      if (!operator) {
        throw new Error('Unexpected expression.');
      }

      let { start } = node.sourceSpan;

      if (operator === 'typeof' || operator === 'void') {
        const index = this.text.lastIndexOf(operator, start);

        /* c8 ignore next 7 */
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
          end: getOuterEnd(expression),
        },
        ancestors,
        { isInParentParens: isInParentParens },
      );
    }

    if (
      node instanceof angular.KeyedRead ||
      node instanceof angular.SafeKeyedRead
    ) {
      return this.#transformReceiverAndName(
        node,
        this.transform<babel.Expression>(node.key),
        ancestors,
        {
          computed: true,
          optional: node instanceof angular.SafeKeyedRead,
          isInParentParens: isInParentParens,
        },
      );
    }

    if (
      node instanceof angular.PropertyRead ||
      node instanceof angular.SafePropertyRead
    ) {
      const { receiver, name } = node;
      const tName = this.#create<babel.Identifier>(
        {
          type: 'Identifier',
          name,
          ...node.nameSpan,
        },
        ancestors,
        isImplicitThis(receiver, this.#text)
          ? { isInParentParens: isInParentParens }
          : {},
      );
      return this.#transformReceiverAndName(node, tName, ancestors, {
        computed: false,
        optional: node instanceof angular.SafePropertyRead,
        isInParentParens: isInParentParens,
      });
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
      const { elements, expressions } = node;

      return this.#create<babel.TemplateLiteral>(
        {
          type: 'TemplateLiteral',
          quasis: elements.map((element) =>
            this.transform(element, childTransformOptions),
          ),
          expressions: expressions.map((expression) =>
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
        { stripSpaces: false },
      );
    }

    if (node instanceof angular.ParenthesizedExpression) {
      return this.transform(node.expression, childTransformOptions);
    }

    /* c8 ignore next */
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
