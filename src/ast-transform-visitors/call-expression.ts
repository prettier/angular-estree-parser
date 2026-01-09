import { type Call, type SafeCall } from '@angular/compiler';
import type * as babel from '@babel/types';

import { type NodeTransformer } from '../ast-transform/node-transformer.ts';
import { isOptionalObjectOrCallee } from '../utilities.ts';

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
  (
    node: Visitor['node'],
    transformer: NodeTransformer,
  ): babel.CallExpression | babel.OptionalCallExpression => {
    const arguments_ = transformer.transformChildren<babel.Expression>(
      node.args,
    );
    const callee = transformer.transformChild<babel.Expression>(node.receiver);

    if (optional || isOptionalObjectOrCallee(callee)) {
      return {
        type: 'OptionalCallExpression',
        callee,
        arguments: arguments_,
        optional,
      };
    }

    return { type: 'CallExpression', callee, arguments: arguments_ };
  };

export const visitCall = transformCall<VisitorCall>(callOptions);
export const visitSafeCall = transformCall<VisitorSafeCall>(safeCallOptions);
