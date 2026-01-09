import { visitorKeys as nodeVisitorKeys } from './ast-transform-visitors/visitor-keys.ts';
import { visitorKeys as microsyntaxNodeVisitorKeys } from './microsyntax/visitor-keys.ts';

export const visitorKeys = {
  ...nodeVisitorKeys,
  ...microsyntaxNodeVisitorKeys,
};
