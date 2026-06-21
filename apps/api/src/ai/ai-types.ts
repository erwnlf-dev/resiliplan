/**
 * AI Provider Configuration — BYO (Bring Your Own) multi-provider support
 * Supports OpenAI, Anthropic, Google Gemini, and OpenAI-compatible (custom baseUrl).
 */

import { z } from 'zod';

export const AIProviderType = z.enum(['openai', 'anthropic', 'google', 'openai_compatible']);
export type AIProviderType = z.infer<typeof AIProviderType>;

// Default models per provider (used as placeholder in UI)
export const AI_PROVIDER_DEFAULTS: Record<AIProviderType, { model: string; baseUrl?: string; label: string }> = {
  openai: { model: 'gpt-4o-mini', label: 'OpenAI' },
  anthropic: { model: 'claude-3-5-sonnet-latest', label: 'Anthropic' },
  google: { model: 'gemini-1.5-flash', label: 'Google Gemini' },
  openai_compatible: { model: '', baseUrl: '', label: 'OpenAI-compatible (custom baseUrl)' },
};

export const AIProviderConfigSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  provider: AIProviderType,
  apiKey: z.string().min(1, 'API key is required'),
  model: z.string().min(1, 'Model name is required').default('gpt-4o-mini'),
  baseUrl: z.string().url().optional().or(z.literal('')),
  maxTokens: z.coerce.number().int().positive().default(2048),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  enabled: z.boolean().default(true),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type AIProviderConfig = z.infer<typeof AIProviderConfigSchema>;

// Base create schema (used for both create and partial updates)
const AIProviderCreateBaseSchema = z.object({
  provider: AIProviderType,
  apiKey: z.string().min(1, 'API key is required'),
  model: z.string().min(1, 'Model name is required'),
  baseUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  maxTokens: z.coerce.number().int().positive().default(2048),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  enabled: z.boolean().default(true),
});

// Create: requires provider switcher validation
export const AIProviderCreateSchema = AIProviderCreateBaseSchema.superRefine((data, ctx) => {
  if (data.provider === 'openai_compatible' && !data.baseUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['baseUrl'],
      message: 'baseUrl is required for openai_compatible provider',
    });
  }
});

export type AIProviderCreate = z.infer<typeof AIProviderCreateSchema>;

// Update: partial; validate baseUrl when switching to openai_compatible
export const AIProviderUpdateSchema = AIProviderCreateBaseSchema.partial().superRefine((data, ctx) => {
  if (data.provider === 'openai_compatible' && data.baseUrl === '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['baseUrl'],
      message: 'baseUrl cannot be empty for openai_compatible provider',
    });
  }
});
export type AIProviderUpdate = z.infer<typeof AIProviderUpdateSchema>;

// Suggestion request/response schemas — extended with mode for specialized output
export const AISuggestionMode = z.enum(['draft', 'improve', 'steps', 'test', 'comms', 'escalation']);
export type AISuggestionMode = z.infer<typeof AISuggestionMode>;
export const AISuggestionRequestSchema = z.object({
  section: z.string().min(1),
  context: z.string().optional(),
  prompt: z.string().min(1),
  mode: AISuggestionMode.optional(),
  serviceName: z.string().optional(),
  rtoMinutes: z.coerce.number().int().positive().optional(),
  rpoMinutes: z.coerce.number().int().positive().optional(),
  criticality: z.string().optional(),
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

// Plan skeleton generation — used when creating a new DRP from scratch
export const PlanSkeletonRequestSchema = z.object({
  serviceName: z.string().min(1),
  serviceOwner: z.string().optional(),
  rtoMinutes: z.coerce.number().int().positive(),
  rpoMinutes: z.coerce.number().int().positive(),
  criticality: z.string().optional(),
  description: z.string().optional(),
  assets: z.array(z.object({
    name: z.string(),
    type: z.string().optional(),
    criticality: z.string().optional(),
  })).optional(),
  biaEntries: z.array(z.object({
    process: z.string(),
    impact1h: z.number().optional(),
    impact4h: z.number().optional(),
    impact24h: z.number().optional(),
    rtoMinutes: z.number().optional(),
    rpoMinutes: z.number().optional(),
  })).optional(),
});
export type PlanSkeletonRequest = z.infer<typeof PlanSkeletonRequestSchema>;

// Strategy recommendation — reads assets+risks+BIA and recommends a recovery strategy
export const StrategyRecommendationRequestSchema = z.object({
  serviceName: z.string().min(1),
  rtoMinutes: z.coerce.number().int().positive(),
  rpoMinutes: z.coerce.number().int().positive(),
  criticality: z.string().optional(),
  description: z.string().optional(),
  assets: z.array(z.object({
    name: z.string(),
    type: z.string().optional(),
    criticality: z.string().optional(),
  })).optional(),
  biaEntries: z.array(z.object({
    process: z.string(),
    rtoMinutes: z.number().optional(),
    rpoMinutes: z.number().optional(),
  })).optional(),
  budgetTier: z.enum(['minimal', 'moderate', 'aggressive']).optional(),
});
export type StrategyRecommendationRequest = z.infer<typeof StrategyRecommendationRequestSchema>;

// Recovery steps generator — ordered steps with preconditions, owners, time targets
export const RecoveryStepsRequestSchema = z.object({
  serviceName: z.string().min(1),
  serviceDescription: z.string().optional(),
  rtoMinutes: z.coerce.number().int().positive(),
  rpoMinutes: z.coerce.number().int().positive(),
  strategy: z.string().optional(),
  stepsCount: z.coerce.number().int().min(3).max(40).default(15),
  existingSteps: z.string().optional(),
});
export type RecoveryStepsRequest = z.infer<typeof RecoveryStepsRequestSchema>;

// Test scenario generator — quarterly test plan
export const TestScenariosRequestSchema = z.object({
  serviceName: z.string().min(1),
  serviceDescription: z.string().optional(),
  strategy: z.string().optional(),
  existingTests: z.string().optional(),
});
export type TestScenariosRequest = z.infer<typeof TestScenariosRequestSchema>;

// Suggestion request — extended fields are defined earlier in this file (with mode, serviceName, rtoMinutes, etc.)

// Test-connection request
export const AITestConnectionSchema = z.object({
  provider: AIProviderType,
  apiKey: z.string().min(1),
  model: z.string().min(1),
  baseUrl: z.string().url().optional().or(z.literal('')),
});
export type AITestConnectionRequest = z.infer<typeof AITestConnectionSchema>;
