import { type AstVisitor } from '@angular/compiler';

import * as visitors from './visitors/index.ts';

type TransformVisitors = Required<Omit<AstVisitor, 'visit'>>;

export const transformVisitors: TransformVisitors = visitors;
