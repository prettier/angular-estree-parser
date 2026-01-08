import { type ImplicitReceiver } from '@angular/compiler';

function transformUnexpectedNode<T extends ImplicitReceiver>(node: T) {
  throw new Error(`Unexpected node type '${node.constructor.name}'`);
}

// Handled in `./transform-member-expression.ts`
export const visitImplicitReceiver = transformUnexpectedNode<ImplicitReceiver>;
