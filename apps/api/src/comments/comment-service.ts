import { z } from 'zod';

export const commentStatusSchema = z.enum(['open', 'resolved']);

export const createCommentSchema = z.object({
  sectionKey: z.string().min(2),
  body: z.string().min(3),
  parentCommentId: z.string().uuid().optional(),
  status: commentStatusSchema.default('open'),
});

export const updateCommentSchema = z.object({
  body: z.string().min(3).optional(),
  status: commentStatusSchema.optional(),
});

export function extractMentionedEmails(body: string): string[] {
  const matches = body.match(/@[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(matches.map((mention) => mention.slice(1).toLowerCase()))];
}

export function summarizeComments(comments: Array<{ status: string; parentCommentId?: string | null; mentionedEmails?: string[] | null }>) {
  return {
    totalComments: comments.length,
    openComments: comments.filter((comment) => comment.status === 'open').length,
    resolvedComments: comments.filter((comment) => comment.status === 'resolved').length,
    topLevelComments: comments.filter((comment) => !comment.parentCommentId).length,
    replies: comments.filter((comment) => Boolean(comment.parentCommentId)).length,
    mentions: comments.reduce((total, comment) => total + (comment.mentionedEmails?.length ?? 0), 0),
  };
}
