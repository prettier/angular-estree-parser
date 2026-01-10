import { type AstVisitor } from '@angular/compiler';

import * as transforms from './transforms/index.ts';

type TransformVisitors = Required<Omit<AstVisitor, 'visit'>>;

export const transformVisitors: TransformVisitors = transforms;
