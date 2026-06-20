/**
 * AI Provider Configuration — BYO (Bring Your Own) multi-provider support
 * Supports OpenAI, Anthropic, Google Gemini with per-tenant configuration.
 */

import { z } from 'zod';

export const AIProviderType = z.enum(['openai', 'anthropic', 'google']);
export type AIProviderType = z.infer<typeof AIProviderType>;

export const AIProviderConfigSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  provider: AIProviderType,
  apiKey: z.string().min(1, 'API key is required'),
  model: z.string().min(1, 'Model name is required').default('gpt-4o-mini'),
  maxTokens: z.coerce.number().int().positive().default(2048),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  enabled: z.boolean().default(true),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type AIProviderConfig = z.infer<typeof AIProviderConfigSchema>;

export const AIProviderCreateSchema = AIProviderConfigSchema.omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});

export type AIProviderCreate = z.infer<typeof AIProviderCreateSchema>;

export const AIProviderUpdateSchema = AIProviderCreateSchema.partial();
export type AIProviderUpdate = z.infer<typeof AIProviderUpdateSchema>;

// Suggestion request/response schemas
export const AISuggestionRequestSchema = z.object({
  section: z.string().min(1),
  context: z.string().optional(),
  prompt: z.string().min(1),
});

export type AISuggestionRequest = z.infer<typeof AISuggestionRequestSchema>;

export const BIAAnalysisRequestSchema = z.object({
  biaEntries: z.array(z.object({
    id: z.string(),
    process: z.string(),
    impact1h: z.number(),
    impact4h: z.number(),
    impact24h: z.number(),
    financialImpact: z.number(),
    reputationImpact: z.number(),
    regulatoryImpact: z.number(),
  })),
});

export type BIAAnalysisRequest = z.infer<typeof BIAAnalysisRequestSchema>;

export const RiskMitigationRequestSchema = z.object({
  risks: z.array(z.object({
    id: z.string(),
    description: z.string(),
    probability: z.number(),
    impact: z.number(),
    riskScore: z.number(),
  })),
});

export type RiskMitigationRequest = z.infer<typeof RiskMitigationRequestSchema>;

export const RecoveryStrategyRequestSchema = z.object({
  assets: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    criticality: z.string(),
    rto: z.string().optional(),
    rpo: z.string().optional(),
  })),
});

export type RecoveryStrategyRequest = z.infer<typeof RecoveryStrategyRequestSchema>;
