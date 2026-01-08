import { type Call, type SafeCall } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type Transformer } from '../transform-ast.ts';
import { isOptionalObjectOrCallee } from './utilities.ts';

const callOptions = { optional: false } as const;
const safeCallOptions = { optional: true } as const;

type VisitorCall = {
  node: Call;
  options: typeof callOptions;
};
type VisitorSafeCall = {
  node: SafeCall;
  options: typeof safeCallOptions;
};

const transformCall =
  <Visitor extends VisitorCall | VisitorSafeCall>({
    optional,
  }: Visitor['options']) =>
  (node: Visitor['node'], transformer: Transformer) => {
    const arguments_ = transformer.transformChildren<babel.Expression>(
      node.args,
    );
    const callee = transformer.transformChild<babel.Expression>(node.receiver);
    const isOptionalReceiver = isOptionalObjectOrCallee(callee);
    const nodeType =
      optional || isOptionalReceiver
        ? 'OptionalCallExpression'
        : 'CallExpression';
    return transformer.createNode<
      babel.CallExpression | babel.OptionalCallExpression
    >({
      type: nodeType,
      callee,
      arguments: arguments_,
      ...(nodeType === 'OptionalCallExpression' ? { optional } : undefined),
    });
  };

export const visitCall = transformCall<VisitorCall>(callOptions);
export const visitSafeCall = transformCall<VisitorSafeCall>(safeCallOptions);
