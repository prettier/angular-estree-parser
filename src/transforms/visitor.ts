import { type AstVisitor as AngularAstVisitor } from '@angular/compiler';

import * as transforms from './transforms.ts';

type AstVisitor = Required<Omit<AngularAstVisitor, 'visit'>>;

export const transformVisitor: AstVisitor = transforms;
