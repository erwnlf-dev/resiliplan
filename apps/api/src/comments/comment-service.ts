import { z } from 'zod';

export const commentStatusSchema = z.enum(['open', 'resolved']);

export const createCommentSchema = z.object({
  sectionKey: z.string().min(2),
  body: z.string().min(3),
  status: commentStatusSchema.default('open'),
});

export const updateCommentSchema = z.object({
  body: z.string().min(3).optional(),
  status: commentStatusSchema.optional(),
});

export function summarizeComments(comments: Array<{ status: string }>) {
  return {
    totalComments: comments.length,
    openComments: comments.filter((comment) => comment.status === 'open').length,
    resolvedComments: comments.filter((comment) => comment.status === 'resolved').length,
  };
}
