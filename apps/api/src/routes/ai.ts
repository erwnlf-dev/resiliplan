/**
 * AI Co-pilot API routes
 * Streaming suggestions, BIA analysis, risk mitigation, recovery strategy.
 */

import { type FastifyInstance } from 'fastify';
import { aiProviderService } from '../ai/ai-provider-service.js';
import { aiSuggestionService } from '../ai/ai-suggestion-service.js';
import {
  AISuggestionRequestSchema,
  BIAAnalysisRequestSchema,
  RiskMitigationRequestSchema,
  RecoveryStrategyRequestSchema,
  AIProviderCreateSchema,
  AIProviderUpdateSchema,
} from '../ai/ai-types.js';
import { requireAuth, requireRole } from '../auth/auth-service.js';
import { logger } from '../utils/logger.js';

export async function aiRoutes(app: FastifyInstance) {
  // ===== AI Provider CRUD =====

  app.get('/api/v1/ai/providers', async (req) => {
    const user = await requireAuth(req);
    const providers = await aiProviderService.listByTenant(user.tenantId);
    return { providers };
  });

  app.post('/api/v1/ai/providers', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const parsed = AIProviderCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const provider = await aiProviderService.create(user.tenantId, parsed.data);
    logger.info({ providerId: provider.id, tenantId: user.tenantId }, 'AI provider created');
    return reply.code(201).send(provider);
  });

  app.patch('/api/v1/ai/providers/:id', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const { id } = req.params as { id: string };
    const parsed = AIProviderUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const provider = await aiProviderService.update(id, parsed.data);
    return provider;
  });

  app.delete('/api/v1/ai/providers/:id', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const { id } = req.params as { id: string };
    await aiProviderService.delete(id);
    return reply.code(204).send();
  });

  // ===== AI Suggestions (streaming) =====

  app.post('/api/v1/ai/suggest', async (req, reply) => {
    const user = await requireAuth(req);
    const parsed = AISuggestionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const provider = await aiProviderService.getActiveProvider(user.tenantId);
    if (!provider) {
      return reply.code(400).send({ error: 'No active AI provider configured for this tenant' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const stream = await aiSuggestionService.streamSuggestion(user.tenantId, parsed.data);

    for await (const chunk of stream.textStream) {
      reply.raw.write(chunk);
    }

    reply.raw.end();
  });

  // ===== BIA Analysis =====

  app.post('/api/v1/ai/analyze-bia', async (req, reply) => {
    const user = await requireAuth(req);
    const parsed = BIAAnalysisRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const analysis = await aiSuggestionService.analyzeBIA(user.tenantId, parsed.data);
    return { analysis };
  });

  // ===== Risk Mitigation =====

  app.post('/api/v1/ai/risk-mitigation', async (req, reply) => {
    const user = await requireAuth(req);
    const parsed = RiskMitigationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const recommendations = await aiSuggestionService.recommendMitigations(user.tenantId, parsed.data);
    return { recommendations };
  });

  // ===== Recovery Strategy =====

  app.post('/api/v1/ai/recovery-strategy', async (req, reply) => {
    const user = await requireAuth(req);
    const parsed = RecoveryStrategyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const strategies = await aiSuggestionService.suggestRecoveryStrategies(user.tenantId, parsed.data);
    return { strategies };
  });
}
