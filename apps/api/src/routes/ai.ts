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
  AITestConnectionSchema,
  PlanSkeletonRequestSchema,
  StrategyRecommendationRequestSchema,
  RecoveryStepsRequestSchema,
  TestScenariosRequestSchema,
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

  // Test connection without persisting — accepts an inline config
  app.post('/api/v1/ai/providers/test', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const parsed = AITestConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    try {
      const model = aiSuggestionService.buildModel(parsed.data);
      const result = await aiSuggestionService.testConnection(model);
      return { ok: true, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      logger.warn({ err: message, provider: parsed.data.provider }, 'AI connection test failed');
      return reply.code(200).send({ ok: false, error: message });
    }
  });

  // Toggle enabled flag quickly
  app.post('/api/v1/ai/providers/:id/toggle', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const { id } = req.params as { id: string };
    const existing = await aiProviderService.getById(id);
    if (!existing) return reply.code(404).send({ error: 'Provider not found' });
    const updated = await aiProviderService.update(id, { enabled: !existing.enabled });
    return updated;
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

  // ===== Plan skeleton (full 14-section draft) =====

  app.post('/api/v1/ai/plan-skeleton', async (req, reply) => {
    const user = await requireAuth(req);
    const parsed = PlanSkeletonRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    try {
      const skeleton = await aiSuggestionService.generatePlanSkeleton(user.tenantId, parsed.data);
      return { skeleton };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Plan skeleton generation failed';
      logger.warn({ err: message, tenantId: user.tenantId }, 'AI plan skeleton failed');
      return reply.code(400).send({ error: message });
    }
  });

  // ===== Strategy recommendation (structured JSON) =====

  app.post('/api/v1/ai/strategy-recommendation', async (req, reply) => {
    const user = await requireAuth(req);
    const parsed = StrategyRecommendationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    try {
      const raw = await aiSuggestionService.recommendStrategy(user.tenantId, parsed.data);
      // Try to parse JSON; strip code fences if any
      const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      let parsed_json: unknown = null;
      try { parsed_json = JSON.parse(cleaned); } catch { parsed_json = { primaryStrategy: 'unknown', rationale: cleaned }; }
      return { recommendation: parsed_json, raw };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Strategy recommendation failed';
      logger.warn({ err: message, tenantId: user.tenantId }, 'AI strategy recommendation failed');
      return reply.code(400).send({ error: message });
    }
  });

  // ===== Recovery steps generator =====

  app.post('/api/v1/ai/recovery-steps', async (req, reply) => {
    const user = await requireAuth(req);
    const parsed = RecoveryStepsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    try {
      const steps = await aiSuggestionService.generateRecoverySteps(user.tenantId, parsed.data);
      return { steps };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Recovery steps generation failed';
      logger.warn({ err: message, tenantId: user.tenantId }, 'AI recovery steps failed');
      return reply.code(400).send({ error: message });
    }
  });

  // ===== Test scenarios generator =====

  app.post('/api/v1/ai/test-scenarios', async (req, reply) => {
    const user = await requireAuth(req);
    const parsed = TestScenariosRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    try {
      const tests = await aiSuggestionService.generateTestScenarios(user.tenantId, parsed.data);
      return { tests };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test scenarios generation failed';
      logger.warn({ err: message, tenantId: user.tenantId }, 'AI test scenarios failed');
      return reply.code(400).send({ error: message });
    }
  });
}
