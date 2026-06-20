import { describe, expect, it } from 'vitest';
import { createCommentSchema, summarizeComments } from './comment-service.js';

describe('comment-service', () => {
  it('accepts section-scoped review comments', () => {
    const comment = createCommentSchema.parse({
      sectionKey: 'recovery-strategy',
      body: 'Need validate DNS cutover owner.',
    });

    expect(comment).toEqual({
      sectionKey: 'recovery-strategy',
      body: 'Need validate DNS cutover owner.',
      status: 'open',
    });
  });

  it('summarizes open and resolved comments', () => {
    expect(summarizeComments([
      { status: 'open' },
      { status: 'open' },
      { status: 'resolved' },
    ])).toEqual({ totalComments: 3, openComments: 2, resolvedComments: 1 });
  });
});
