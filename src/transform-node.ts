import * as ng from '@angular/compiler';
import type * as b from '@babel/types';
import Context from './context.js';
import type {
  NGChainedExpression,
  NGEmptyExpression,
  NGNode,
  NGPipeExpression,
  RawNGSpan,
  LocationInformation,
} from './types.js';
import { createNode } from './utils.js';

function isParenthesized(node: NGNode) {
  return Boolean(node.extra?.parenthesized);
}
function getOuterStart(node: NGNode): number {
  return isParenthesized(node) ? node.extra.parenStart : node.start;
}
function getOuterEnd(node: NGNode): number {
  return isParenthesized(node) ? node.extra.parenEnd : node.end;
}

function isOptionalObjectOrCallee(node: NGNode): boolean {
  return (
    (node.type === 'OptionalCallExpression' ||
      node.type === 'OptionalMemberExpression') &&
    !isParenthesized(node)
  );
}

function isImplicitThis(node: ng.AST, text: string): boolean {
  const { start, end } = node.sourceSpan;
  return start >= end || /^\s+$/.test(text.slice(start, end));
}

class Transformer extends Context {
  #ast;
  #text;

  constructor(ast: ng.AST, text: string) {
    super(text);
    this.#ast = ast;
    this.#text = text;
  }

  static transform(ast: ng.AST, text: string) {
    return new Transformer(ast, text).ast;
  }

  get ast() {
    return this.#transform(this.#ast);
  }

  #create<T extends NGNode>(
    properties: Partial<T> & { type: T['type'] } & RawNGSpan,
    { stripSpaces = true, hasParentParens = false } = {},
  ) {
    return createNode<T>(this, properties, {
      stripSpaces,
      hasParentParens,
    });
  }

  #transformReceiverAndName(
    receiver: ng.AST,
    property: b.Expression,
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
    const object = this.#transform<b.Expression>(receiver);
    const isOptionalObject = isOptionalObjectOrCallee(object);
    return this.#create<b.OptionalMemberExpression | b.MemberExpression>(
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

  #transform<T extends NGNode>(node: ng.AST, isInParentParens = false) {
    return this.#transformNode(node, isInParentParens) as T &
      LocationInformation;
  }
  #transformNode(node: ng.AST, isInParentParens = false): NGNode {
    if (node instanceof ng.Interpolation) {
      const { expressions } = node;

      if (expressions.length !== 1) {
        throw new Error("Unexpected 'Interpolation'");
      }

      return this.#transform(expressions[0]);
    }

    if (node instanceof ng.Unary) {
      return this.#create<b.UnaryExpression>(
        {
          type: 'UnaryExpression',
          prefix: true,
          argument: this.#transform<b.Expression>(node.expr),
          operator: node.operator as '-' | '+',
          ...node.sourceSpan,
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof ng.Binary) {
      const {
        left: originalLeft,
        operation: operator,
        right: originalRight,
      } = node;
      const left = this.#transform<b.Expression>(originalLeft);
      const right = this.#transform<b.Expression>(originalRight);
      const start = getOuterStart(left);
      const end = getOuterEnd(right);
      const properties = {
        left,
        right,
        start,
        end,
      };

      if (operator === '&&' || operator === '||' || operator === '??') {
        return this.#create<b.LogicalExpression>(
          {
            ...properties,
            type: 'LogicalExpression',
            operator: operator as b.LogicalExpression['operator'],
          },
          { hasParentParens: isInParentParens },
        );
      }

      return this.#create<b.BinaryExpression>(
        {
          ...properties,
          type: 'BinaryExpression',
          operator: operator as b.BinaryExpression['operator'],
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof ng.BindingPipe) {
      const { exp: expressionNode, name, args: originalArguments } = node;
      const left = this.#transform<b.Expression>(expressionNode);
      const start = getOuterStart(left);
      const leftEnd = getOuterEnd(left);
      const rightStart = this.getCharacterIndex(
        /\S/,
        this.getCharacterIndex('|', leftEnd) + 1,
      );
      const right = this.#create<b.Identifier>({
        type: 'Identifier',
        name,
        start: rightStart,
        end: rightStart + name.length,
      });
      const argumentNodes = originalArguments.map<b.Expression>((node) =>
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

    if (node instanceof ng.Chain) {
      return this.#create<NGChainedExpression>(
        {
          type: 'NGChainedExpression',
          expressions: node.expressions.map<b.Expression>((node) =>
            this.#transform(node),
          ),
          ...node.sourceSpan,
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof ng.Conditional) {
      const { condition, trueExp, falseExp } = node;
      const test = this.#transform<b.Expression>(condition);
      const consequent = this.#transform<b.Expression>(trueExp);
      const alternate = this.#transform<b.Expression>(falseExp);
      return this.#create<b.ConditionalExpression>(
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

    if (node instanceof ng.EmptyExpr) {
      return this.#create<NGEmptyExpression>(
        { type: 'NGEmptyExpression', ...node.sourceSpan },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof ng.ImplicitReceiver) {
      return this.#create<b.ThisExpression>(
        { type: 'ThisExpression', ...node.sourceSpan },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof ng.KeyedRead || node instanceof ng.SafeKeyedRead) {
      return this.#transformReceiverAndName(
        node.receiver,
        this.#transform<b.Expression>(node.key),
        {
          computed: true,
          optional: node instanceof ng.SafeKeyedRead,
          end: node.sourceSpan.end, // ]
          hasParentParens: isInParentParens,
        },
      );
    }

    if (node instanceof ng.LiteralArray) {
      return this.#create<b.ArrayExpression>(
        {
          type: 'ArrayExpression',
          elements: node.expressions.map<b.Expression>((node) =>
            this.#transform(node),
          ),
          ...node.sourceSpan,
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof ng.LiteralMap) {
      const { keys, values } = node;
      const tValues = values.map((value) =>
        this.#transform<b.Expression>(value),
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
          ? this.#create<b.StringLiteral>({
              type: 'StringLiteral',
              value: key,
              ...keySpan,
            })
          : this.#create<b.Identifier>({
              type: 'Identifier',
              name: key,
              ...keySpan,
            });
        const shorthand = tKey.end < tKey.start || keyStart === valueStart;

        return this.#create<b.ObjectProperty>({
          type: 'ObjectProperty',
          key: tKey,
          value: tValue,
          shorthand,
          computed: false,
          start: getOuterStart(tKey),
          end: valueEnd,
        });
      });
      return this.#create<b.ObjectExpression>(
        {
          type: 'ObjectExpression',
          properties: tProperties,
          ...node.sourceSpan,
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof ng.LiteralPrimitive) {
      const { value } = node;
      switch (typeof value) {
        case 'boolean':
          return this.#create<b.BooleanLiteral>(
            { type: 'BooleanLiteral', value, ...node.sourceSpan },
            { hasParentParens: isInParentParens },
          );
        case 'number':
          return this.#create<b.NumericLiteral>(
            { type: 'NumericLiteral', value, ...node.sourceSpan },
            { hasParentParens: isInParentParens },
          );
        case 'object':
          return this.#create<b.NullLiteral>(
            { type: 'NullLiteral', ...node.sourceSpan },
            { hasParentParens: isInParentParens },
          );
        case 'string':
          return this.#create<b.StringLiteral>(
            { type: 'StringLiteral', value, ...node.sourceSpan },
            { hasParentParens: isInParentParens },
          );
        case 'undefined':
          return this.#create<b.Identifier>(
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

    if (node instanceof ng.Call || node instanceof ng.SafeCall) {
      const isOptionalType = node instanceof ng.SafeCall;
      const { receiver, args } = node;
      const tArgs =
        args.length === 1
          ? [this.#transform<b.Expression>(args[0], true)]
          : (args as ng.AST[]).map<b.Expression>((node) =>
              this.#transform(node),
            );
      const tReceiver = this.#transform<b.Expression>(receiver!);
      const isOptionalReceiver = isOptionalObjectOrCallee(tReceiver);
      const nodeType =
        isOptionalType || isOptionalReceiver
          ? 'OptionalCallExpression'
          : 'CallExpression';
      return this.#create<b.CallExpression | b.OptionalCallExpression>(
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

    if (node instanceof ng.NonNullAssert) {
      const expression = this.#transform<b.Expression>(node.expression);
      return this.#create<b.TSNonNullExpression>(
        {
          type: 'TSNonNullExpression',
          expression: expression,
          start: getOuterStart(expression),
          end: node.sourceSpan.end, // !
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof ng.PrefixNot) {
      const expression = this.#transform<b.Expression>(node.expression);
      return this.#create<b.UnaryExpression>(
        {
          type: 'UnaryExpression',
          prefix: true,
          operator: '!',
          argument: expression,
          start: node.sourceSpan.start, // !
          end: getOuterEnd(expression),
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (
      node instanceof ng.PropertyRead ||
      node instanceof ng.SafePropertyRead
    ) {
      const { receiver, name } = node;
      const nameEnd =
        this.getCharacterLastIndex(/\S/, node.sourceSpan.end - 1) + 1;
      const tName = this.#create<b.Identifier>(
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
        optional: node instanceof ng.SafePropertyRead,
        hasParentParens: isInParentParens,
      });
    }

    if (node instanceof ng.KeyedWrite) {
      const key = this.#transform<b.Expression>(node.key);
      const right = this.#transform<b.Expression>(node.value);
      const left = this.#transformReceiverAndName(node.receiver, key, {
        computed: true,
        optional: false,
        end: this.getCharacterIndex(']', getOuterEnd(key)) + 1,
      });
      return this.#create<b.AssignmentExpression>(
        {
          type: 'AssignmentExpression',
          left: left as b.MemberExpression,
          operator: '=',
          right,
          start: getOuterStart(left),
          end: getOuterEnd(right),
        },
        { hasParentParens: isInParentParens },
      );
    }

    if (node instanceof ng.PropertyWrite) {
      const { receiver, name, value } = node;
      const tValue = this.#transform<b.Expression>(value);
      const nameEnd =
        this.getCharacterLastIndex(
          /\S/,
          this.getCharacterLastIndex('=', getOuterStart(tValue) - 1) - 1,
        ) + 1;
      const tName = this.#create<b.Identifier>({
        type: 'Identifier',
        name,
        start: nameEnd - name.length,
        end: nameEnd,
      });
      const tReceiverAndName = this.#transformReceiverAndName(receiver, tName, {
        computed: false,
        optional: false,
      });
      return this.#create<b.AssignmentExpression>(
        {
          type: 'AssignmentExpression',
          left: tReceiverAndName as b.MemberExpression,
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
function transform(ast: ng.AST, text: string): NGNode {
  return Transformer.transform(ast, text);
}

export default transform;
