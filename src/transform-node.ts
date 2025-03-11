import * as angular from '@angular/compiler';
import type * as babel from '@babel/types';

import Source from './source.js';
import type {
  LocationInformation,
  NGChainedExpression,
  NGEmptyExpression,
  NGNode,
  NGPipeExpression,
  RawNGSpan,
} from './types.js';

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

class Transformer extends Source {
  #node;
  #text;

  constructor(ast: angular.AST | undefined, text: string) {
    super(text);
    this.#node = ast;
    this.#text = text;
  }

  get node() {
    return this.#transform(this.#node!);
  }

  transformNode<T extends NGNode>(node: angular.AST) {
    return this.#transformNode(node) as T & LocationInformation;
  }

  #create<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] } & RawNGSpan,
    { stripSpaces = true, hasParentParens = false } = {},
  ) {
    return this.createNode<T>(properties, { stripSpaces, hasParentParens });
  }

  #transformReceiverAndName(
    receiver: angular.AST,
    property: babel.Expression,
    {
      computed,
      optional,
      end = getOuterEnd(property),
      hasParentParens = false,
    }: {
      computed: boolean;
      optional: boolean;
      end?: number;
      hasParentParens?: boolean;
    },
  ) {
    if (
      isImplicitThis(receiver, this.#text) ||
      receiver.sourceSpan.start === property.start
    ) {
      return property;
    }
    const object = this.#transform<babel.Expression>(receiver);
    const isOptionalObject = isOptionalObjectOrCallee(object);
    return this.#create<
      babel.OptionalMemberExpression | babel.MemberExpression
    >(
      {
        type:
          optional || isOptionalObject
            ? 'OptionalMemberExpression'
            : 'MemberExpression',
        object,
        property,
        computed: computed,
        ...(optional
          ? { optional: true }
          : isOptionalObject
            ? { optional: false }
            : undefined),
        start: getOuterStart(object),
        end,
      },
      { hasParentParens },
    );
  }

  #transform<T extends NGNode>(node: angular.AST, isInParentParens = false) {
    return this.#transformNode(node, isInParentParens) as T &
      LocationInformation;
  }

  #transformNode(node: angular.AST, isInParentParens = false): NGNode {
    if (node instanceof angular.Interpolation) {
      const { expressions } = node;

      // istanbul ignore next 3
      if (expressions.length !== 1) {
        throw new Error("Unexpected 'Interpolation'");
      }

      return this.#transform(expressions[0]);
    }

    if (node instanceof angular.Unary) {
      return this.#create<babel.UnaryExpression>(
        {
          type: 'UnaryExpression',
          prefix: true,
          argument: this.#transform<babel.Expression>(node.expr),
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
      const left = this.#transform<babel.Expression>(originalLeft);
      const right = this.#transform<babel.Expression>(originalRight);
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
      const left = this.#transform<babel.Expression>(expressionNode);
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
        this.#transform(node),
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
            this.#transform(node),
          ),
          ...node.sourceSpan,
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.Conditional) {
      const { condition, trueExp, falseExp } = node;
      const test = this.#transform<babel.Expression>(condition);
      const consequent = this.#transform<babel.Expression>(trueExp);
      const alternate = this.#transform<babel.Expression>(falseExp);
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

    if (
      node instanceof angular.KeyedRead ||
      node instanceof angular.SafeKeyedRead
    ) {
      return this.#transformReceiverAndName(
        node.receiver,
        this.#transform<babel.Expression>(node.key),
        {
          computed: true,
          optional: node instanceof angular.SafeKeyedRead,
          end: node.sourceSpan.end, // ]
          hasParentParens: isInParentParens,
        },
      );
    }

    if (node instanceof angular.LiteralArray) {
      return this.#create<babel.ArrayExpression>(
        {
          type: 'ArrayExpression',
          elements: node.expressions.map<babel.Expression>((node) =>
            this.#transform(node),
          ),
          ...node.sourceSpan,
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.LiteralMap) {
      const { keys, values } = node;
      const tValues = values.map((value) =>
        this.#transform<babel.Expression>(value),
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
        // istanbul ignore next
        default:
          throw new Error(
            `Unexpected LiteralPrimitive value type ${typeof value}`,
          );
      }
    }

    if (node instanceof angular.Call || node instanceof angular.SafeCall) {
      const isOptionalType = node instanceof angular.SafeCall;
      const { receiver, args } = node;
      const tArgs =
        args.length === 1
          ? [this.#transform<babel.Expression>(args[0], true)]
          : (args as angular.AST[]).map<babel.Expression>((node) =>
              this.#transform(node),
            );
      const tReceiver = this.#transform<babel.Expression>(receiver!);
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
          optional:
            nodeType === 'OptionalCallExpression' ? isOptionalType : undefined,
          start: getOuterStart(tReceiver),
          end: node.sourceSpan.end, // )
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.NonNullAssert) {
      const expression = this.#transform<babel.Expression>(node.expression);
      return this.#create<babel.TSNonNullExpression>(
        {
          type: 'TSNonNullExpression',
          expression: expression,
          start: getOuterStart(expression),
          end: node.sourceSpan.end, // !
        },
        { hasParentParens: isInParentParens },
      );
    }

    const isPrefixNot = node instanceof angular.PrefixNot;
    if (isPrefixNot || node instanceof angular.TypeofExpression) {
      const expression = this.#transform<babel.Expression>(node.expression);

      const operator = isPrefixNot ? '!' : 'typeof';
      let { start } = node.sourceSpan;

      if (!isPrefixNot) {
        const index = this.text.lastIndexOf(operator, start);

        // istanbul ignore next 7
        if (index === -1) {
          throw new Error(
            `Cannot find operator ${operator} from index ${start} in ${JSON.stringify(
              this.text,
            )}`,
          );
        }

        start = index;
      }

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
      node instanceof angular.PropertyRead ||
      node instanceof angular.SafePropertyRead
    ) {
      const { receiver, name } = node;
      const nameEnd =
        this.getCharacterLastIndex(/\S/, node.sourceSpan.end - 1) + 1;
      const tName = this.#create<babel.Identifier>(
        {
          type: 'Identifier',
          name,
          start: nameEnd - name.length,
          end: nameEnd,
        },
        isImplicitThis(receiver, this.#text)
          ? { hasParentParens: isInParentParens }
          : {},
      );
      return this.#transformReceiverAndName(receiver, tName, {
        computed: false,
        optional: node instanceof angular.SafePropertyRead,
        hasParentParens: isInParentParens,
      });
    }

    if (node instanceof angular.KeyedWrite) {
      const key = this.#transform<babel.Expression>(node.key);
      const right = this.#transform<babel.Expression>(node.value);
      const left = this.#transformReceiverAndName(node.receiver, key, {
        computed: true,
        optional: false,
        end: this.getCharacterIndex(']', getOuterEnd(key)) + 1,
      });
      return this.#create<babel.AssignmentExpression>(
        {
          type: 'AssignmentExpression',
          left: left as babel.MemberExpression,
          operator: '=',
          right,
          start: getOuterStart(left),
          end: getOuterEnd(right),
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof angular.PropertyWrite) {
      const { receiver, name, value } = node;
      const tValue = this.#transform<babel.Expression>(value);
      const nameEnd =
        this.getCharacterLastIndex(
          /\S/,
          this.getCharacterLastIndex('=', getOuterStart(tValue) - 1) - 1,
        ) + 1;
      const tName = this.#create<babel.Identifier>({
        type: 'Identifier',
        name,
        start: nameEnd - name.length,
        end: nameEnd,
      });
      const tReceiverAndName = this.#transformReceiverAndName(receiver, tName, {
        computed: false,
        optional: false,
      });
      return this.#create<babel.AssignmentExpression>(
        {
          type: 'AssignmentExpression',
          left: tReceiverAndName as babel.MemberExpression,
          operator: '=',
          right: tValue,
          start: getOuterStart(tReceiverAndName),
          end: getOuterEnd(tValue),
        },
        { hasParentParens: isInParentParens },
      );
    }

    // istanbul ignore next
    throw Object.assign(new Error('Unexpected node'), { node });
  }
}

// See `convertAst` in `@angular/compiler`
// ASTWithSource (Not handled)
// PropertyRead
// PropertyWrite
// KeyedWrite
// Call
// LiteralPrimitive
// Unary
// Binary
// ThisReceiver (Not handled)
// KeyedRead
// Chain
// LiteralMap
// LiteralArray
// Conditional
// NonNullAssert
// BindingPipe
// SafeKeyedRead
// SafePropertyRead
// SafeCall
// EmptyExpr
// PrefixNot
// TypeofExpression
function transform(node: angular.AST, text: string): NGNode {
  return new Transformer(node, text).node;
}

export { transform, Transformer };
