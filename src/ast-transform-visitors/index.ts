import { type AstVisitor } from '@angular/compiler';

import * as visitors from './visitors.ts';

type TransformVisitors = Required<Omit<AstVisitor, 'visit'>>;

export const transformVisitors: TransformVisitors = visitors;
