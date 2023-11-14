import type { RawNGComment } from './types.js';
import type { CommentLine } from '@babel/types';
import { sourceSpanToLocationInformation } from './utils.js';

function transformComment(comment: RawNGComment): CommentLine {
  const { value, sourceSpan } = comment;
  return {
    type: 'CommentLine',
    value,
    ...sourceSpanToLocationInformation(sourceSpan),
  };
}

export default transformComment;
