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
  parent?: angular.AST;
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
  ): T & LocationInformation {
    return this.#transformNode(node, options) as T & LocationInformation;
  }

  #create<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] } & RawNGSpan,
    { stripSpaces = true, hasParentParens = false } = {},
  ) {
    return this.createNode<T>(properties, { stripSpaces, hasParentParens });
  }

  #transformReceiverAndName(
    node:
      | angular.KeyedRead
      | angular.SafeKeyedRead
      | angular.PropertyRead
      | angular.SafePropertyRead,
    property: babel.Expression,
    {
      computed,
      optional,
      hasParentParens = false,
    }: {
      computed: boolean;
      optional: boolean;
      hasParentParens?: boolean;
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
        { hasParentParens },
      );
    }

    if (computed) {
      return this.#create<babel.MemberExpressionComputed>(
        {
          type: 'MemberExpression',
          ...commonProps,
          computed: true,
        },
        { hasParentParens },
      );
    }

    return this.#create<babel.MemberExpressionNonComputed>(
      {
        type: 'MemberExpression',
        ...commonProps,
        computed: false,
        property: property as babel.MemberExpressionNonComputed['property'],
      },
      { hasParentParens },
    );
  }

  #transformNode(node: angular.AST, options?: NodeTransformOptions): NGNode {
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

      return this.transform(expressions[0]);
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
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.Binary) {
      const {
        left: originalLeft,
        operation: operator,
        right: originalRight,
      } = node;
      const left = this.transform<babel.Expression>(originalLeft);
      const right = this.transform<babel.Expression>(originalRight);
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
          { hasParentParens: isInParentParens },
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
          { hasParentParens: isInParentParens },
        );
      }

      return this.#create<babel.BinaryExpression>(
        {
          ...properties,
          type: 'BinaryExpression',
          operator: operator as babel.BinaryExpression['operator'],
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.BindingPipe) {
      const { exp: expressionNode, name, args: originalArguments } = node;
      const left = this.transform<babel.Expression>(expressionNode);
      const start = getOuterStart(left);
      const leftEnd = getOuterEnd(left);
      const rightStart = this.getCharacterIndex(
        /\S/,
        this.getCharacterIndex('|', leftEnd) + 1,
      );
      const right = this.#create<babel.Identifier>({
        type: 'Identifier',
        name,
        start: rightStart,
        end: rightStart + name.length,
      });
      const argumentNodes = originalArguments.map<babel.Expression>((node) =>
        this.transform(node),
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
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.Chain) {
      return this.#create<NGChainedExpression>(
        {
          type: 'NGChainedExpression',
          expressions: node.expressions.map<babel.Expression>((node) =>
            this.transform(node),
          ),
          ...node.sourceSpan,
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.Conditional) {
      const { condition, trueExp, falseExp } = node;
      const test = this.transform<babel.Expression>(condition);
      const consequent = this.transform<babel.Expression>(trueExp);
      const alternate = this.transform<babel.Expression>(falseExp);
      return this.#create<babel.ConditionalExpression>(
        {
          type: 'ConditionalExpression',
          test,
          consequent,
          alternate,
          start: getOuterStart(test),
          end: getOuterEnd(alternate),
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.EmptyExpr) {
      return this.#create<NGEmptyExpression>(
        { type: 'NGEmptyExpression', ...node.sourceSpan },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.ImplicitReceiver) {
      return this.#create<babel.ThisExpression>(
        { type: 'ThisExpression', ...node.sourceSpan },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.LiteralArray) {
      return this.#create<babel.ArrayExpression>(
        {
          type: 'ArrayExpression',
          elements: node.expressions.map<babel.Expression>((node) =>
            this.transform(node),
          ),
          ...node.sourceSpan,
        },
        { hasParentParens: isInParentParens },
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
          ? this.#create<babel.StringLiteral>({
              type: 'StringLiteral',
              value: key,
              ...keySpan,
            })
          : this.#create<babel.Identifier>({
              type: 'Identifier',
              name: key,
              ...keySpan,
            });
        const shorthand = tKey.end < tKey.start || keyStart === valueStart;

        return this.#create<babel.ObjectProperty>({
          type: 'ObjectProperty',
          key: tKey,
          value: tValue,
          shorthand,
          computed: false,
          start: getOuterStart(tKey),
          end: valueEnd,
        });
      });
      return this.#create<babel.ObjectExpression>(
        {
          type: 'ObjectExpression',
          properties: tProperties,
          ...node.sourceSpan,
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.LiteralPrimitive) {
      const { value } = node;
      switch (typeof value) {
        case 'boolean':
          return this.#create<babel.BooleanLiteral>(
            { type: 'BooleanLiteral', value, ...node.sourceSpan },
            { hasParentParens: isInParentParens },
          );
        case 'number':
          return this.#create<babel.NumericLiteral>(
            { type: 'NumericLiteral', value, ...node.sourceSpan },
            { hasParentParens: isInParentParens },
          );
        case 'object':
          return this.#create<babel.NullLiteral>(
            { type: 'NullLiteral', ...node.sourceSpan },
            { hasParentParens: isInParentParens },
          );
        case 'string':
          return this.#create<babel.StringLiteral>(
            { type: 'StringLiteral', value, ...node.sourceSpan },
            { hasParentParens: isInParentParens },
          );
        case 'undefined':
          return this.#create<babel.Identifier>(
            { type: 'Identifier', name: 'undefined', ...node.sourceSpan },
            { hasParentParens: isInParentParens },
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
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.Call || node instanceof angular.SafeCall) {
      const isOptionalType = node instanceof angular.SafeCall;
      const { receiver, args } = node;
      const tArgs =
        args.length === 1
          ? [
              this.transform<babel.Expression>(args[0], {
                isInParentParens: true,
              }),
            ]
          : (args as angular.AST[]).map<babel.Expression>((node) =>
              this.transform(node),
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
        { hasParentParens: isInParentParens },
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
        { hasParentParens: isInParentParens },
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
        { hasParentParens: isInParentParens },
      );
    }

    if (
      node instanceof angular.KeyedRead ||
      node instanceof angular.SafeKeyedRead
    ) {
      return this.#transformReceiverAndName(
        node,
        this.transform<babel.Expression>(node.key),
        {
          computed: true,
          optional: node instanceof angular.SafeKeyedRead,
          hasParentParens: isInParentParens,
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
        isImplicitThis(receiver, this.#text)
          ? { hasParentParens: isInParentParens }
          : {},
      );
      return this.#transformReceiverAndName(node, tName, {
        computed: false,
        optional: node instanceof angular.SafePropertyRead,
        hasParentParens: isInParentParens,
      });
    }

    if (node instanceof angular.TaggedTemplateLiteral) {
      return this.#create<babel.TaggedTemplateExpression>({
        type: 'TaggedTemplateExpression',
        tag: this.transform<babel.Expression>(node.tag),
        quasi: this.transform<babel.TemplateLiteral>(node.template),
        ...node.sourceSpan,
      });
    }

    if (node instanceof angular.TemplateLiteral) {
      const { elements, expressions } = node;

      return this.#create<babel.TemplateLiteral>({
        type: 'TemplateLiteral',
        quasis: elements.map((element) =>
          this.transform(element, { parent: node }),
        ),
        expressions: expressions.map((expression) =>
          this.transform(expression),
        ),
        ...node.sourceSpan,
      });
    }

    if (node instanceof angular.TemplateLiteralElement) {
      const { elements } = options!.parent! as angular.TemplateLiteral;
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
        { stripSpaces: false },
      );
    }

    if (node instanceof angular.ParenthesizedExpression) {
      return this.transform(node.expression);
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
