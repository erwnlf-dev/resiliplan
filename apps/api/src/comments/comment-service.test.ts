import { describe, expect, it } from 'vitest';
import { createCommentSchema, extractMentionedEmails, summarizeComments } from './comment-service.js';

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

  it('extracts email mentions from comment bodies', () => {
    expect(extractMentionedEmails('Please check @Reviewer@Datacomm.co.id and @ops@datacomm.co.id. Duplicate @ops@datacomm.co.id')).toEqual([
      'reviewer@datacomm.co.id',
      'ops@datacomm.co.id',
    ]);
  });

  it('summarizes open, resolved, replies, and mentions', () => {
    expect(summarizeComments([
      { status: 'open', parentCommentId: null, mentionedEmails: ['owner@datacomm.co.id'] },
      { status: 'open', parentCommentId: 'parent-1', mentionedEmails: [] },
      { status: 'resolved', parentCommentId: null, mentionedEmails: ['reviewer@datacomm.co.id'] },
    ])).toEqual({
      totalComments: 3,
      openComments: 2,
      resolvedComments: 1,
      topLevelComments: 2,
      replies: 1,
      mentions: 2,
    });
  });
});
