/**
 * AI Suggestion Service — Vercel AI SDK integration
 * Handles streaming responses, BIA analysis, risk mitigation, recovery strategy suggestions.
 */

import { streamText, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { aiProviderService } from './ai-provider-service.js';
import type {
  AISuggestionRequest,
  BIAAnalysisRequest,
  RiskMitigationRequest,
  RecoveryStrategyRequest,
  AITestConnectionRequest,
} from './ai-types.js';

export class AISuggestionService {
  /**
   * Build a language model from a test-connection or stored provider config.
   * Exposed publicly so the test-connection endpoint can use it without
   * touching the database.
   */
  buildModel(config: {
    provider: string;
    apiKey: string;
    model: string;
    baseUrl?: string | null;
  }) {
    return this.createModel(config);
  }

  /**
   * Cheap liveness check for a configured provider — runs a 1-token completion
   * and returns timing + the first characters of the response.
   */
  async testConnection(model: ReturnType<AISuggestionService['createModel']>) {
    const start = Date.now();
    const result = await generateText({
      model,
      prompt: 'Reply with the single word: ok',
      maxOutputTokens: 4,
      temperature: 0,
    });
    return {
      latencyMs: Date.now() - start,
      sample: (result.text ?? '').trim().slice(0, 80),
    };
  }
  /**
   * Create a language model instance from provider config.
   * Supports openai_compatible via custom baseUrl (LiteLLM, Ollama, vLLM, OpenRouter, etc).
   */
  private createModel(provider: {
    provider: string;
    apiKey: string;
    model: string;
    baseUrl?: string | null;
  }) {
    switch (provider.provider) {
      case 'openai': {
        const openai = createOpenAI({ apiKey: provider.apiKey });
        return openai(provider.model);
      }
      case 'anthropic': {
        const anthropic = createAnthropic({ apiKey: provider.apiKey });
        return anthropic(provider.model);
      }
      case 'google': {
        const google = createGoogleGenerativeAI({ apiKey: provider.apiKey });
        return google(provider.model);
      }
      case 'openai_compatible': {
        if (!provider.baseUrl) {
          throw new Error('openai_compatible provider requires baseUrl');
        }
        if (!provider.model) {
          throw new Error('openai_compatible provider requires model name');
        }
        // Reuse the OpenAI SDK with a custom baseUrl — works for any OpenAI-spec endpoint
        const compatible = createOpenAI({
          apiKey: provider.apiKey,
          baseURL: provider.baseUrl,
        });
        return compatible(provider.model);
      }
      default:
        throw new Error(`Unsupported AI provider: ${provider.provider}`);
    }
  }

  /**
   * Stream a text suggestion for a DRP section.
   */
  async streamSuggestion(tenantId: string, request: AISuggestionRequest) {
    const providerConfig = await aiProviderService.getActiveProvider(tenantId);
    if (!providerConfig) {
      throw new Error('No active AI provider configured for this tenant. Add one in Settings > AI Providers.');
    }

    const model = this.createModel(providerConfig);

    const systemPrompt = `You are an expert in ISO 22301 Business Continuity Management and Disaster Recovery Planning.
You help organizations write clear, compliant DR plan sections.
Section: ${request.section}
${request.context ? `\nContext about this organization:\n${request.context}` : ''}

Provide practical, actionable content suitable for a disaster recovery plan.
Use markdown formatting. Be concise but thorough.
Reference relevant ISO 22301 clauses where applicable.`;

    const result = streamText({
      model,
      system: systemPrompt,
      prompt: request.prompt,
      maxOutputTokens: providerConfig.maxTokens,
      temperature: providerConfig.temperature,
    });

    return result;
  }

  /**
   * Generate a text suggestion (non-streaming).
   */
  async generateSuggestion(tenantId: string, request: AISuggestionRequest) {
    const providerConfig = await aiProviderService.getActiveProvider(tenantId);
    if (!providerConfig) {
      throw new Error('No active AI provider configured for this tenant.');
    }

    const model = this.createModel(providerConfig);

    const systemPrompt = `You are an expert in ISO 22301 Business Continuity Management and Disaster Recovery Planning.
Section: ${request.section}
${request.context ? `\nContext:\n${request.context}` : ''}
Provide practical, actionable content. Use markdown formatting.`;

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: request.prompt,
      maxOutputTokens: providerConfig.maxTokens,
      temperature: providerConfig.temperature,
    });

    return result.text;
  }

  /**
   * Analyze BIA entries and provide tier recommendations.
   */
  async analyzeBIA(tenantId: string, request: BIAAnalysisRequest) {
    const providerConfig = await aiProviderService.getActiveProvider(tenantId);
    if (!providerConfig) {
      throw new Error('No active AI provider configured.');
    }

    const model = this.createModel(providerConfig);

    const biaSummary = request.biaEntries
      .map(
        (e) =>
          `- ${e.process}: Impact 1h=${e.impact1h}, 4h=${e.impact4h}, 24h=${e.impact24h} | Financial=${e.financialImpact}, Reputation=${e.reputationImpact}, Regulatory=${e.regulatoryImpact}`,
      )
      .join('\n');

    const prompt = `Analyze the following Business Impact Analysis (BIA) entries and provide:
1. Tier classification review (are current tiers appropriate?)
2. RTO/RPO recommendations based on impact profiles
3. Key risks and dependencies to consider
4. Prioritized recovery sequence

BIA Entries:
${biaSummary}

Respond in structured markdown with clear headings.`;

    const result = await generateText({
      model,
      system:
        'You are a BIA analyst specializing in business continuity and disaster recovery. Provide data-driven recommendations aligned with ISO 22301.',
      prompt,
      maxOutputTokens: providerConfig.maxTokens,
      temperature: 0.3,
    });

    return result.text;
  }

  /**
   * Generate risk mitigation recommendations.
   */
  async recommendMitigations(tenantId: string, request: RiskMitigationRequest) {
    const providerConfig = await aiProviderService.getActiveProvider(tenantId);
    if (!providerConfig) {
      throw new Error('No active AI provider configured.');
    }

    const model = this.createModel(providerConfig);

    const riskSummary = request.risks
      .map(
        (r) =>
          `- ${r.description}: Probability=${r.probability}/5, Impact=${r.impact}/5, Score=${r.riskScore}`,
      )
      .join('\n');

    const prompt = `Provide risk mitigation recommendations for the following risks in a disaster recovery context:

${riskSummary}

For each risk, provide:
1. Recommended mitigation strategies (preventive, detective, corrective)
2. Residual risk assessment after mitigation
3. Implementation priority (immediate / short-term / long-term)
4. Estimated effort and cost considerations

Respond in structured markdown.`;

    const result = await generateText({
      model,
      system:
        'You are a risk management specialist for IT disaster recovery. Provide practical, cost-effective mitigation strategies.',
      prompt,
      maxOutputTokens: providerConfig.maxTokens,
      temperature: 0.4,
    });

    return result.text;
  }

  /**
   * Generate recovery strategy suggestions based on assets.
   */
  async suggestRecoveryStrategies(
    tenantId: string,
    request: RecoveryStrategyRequest,
  ) {
    const providerConfig = await aiProviderService.getActiveProvider(tenantId);
    if (!providerConfig) {
      throw new Error('No active AI provider configured.');
    }

    const model = this.createModel(providerConfig);

    const assetSummary = request.assets
      .map(
        (a) =>
          `- ${a.name} (${a.type}): Criticality=${a.criticality}${a.rto ? `, RTO=${a.rto}` : ''}${a.rpo ? `, RPO=${a.rpo}` : ''}`,
      )
      .join('\n');

    const prompt = `Suggest recovery strategies for the following IT assets:

${assetSummary}

For each asset, provide:
1. Recommended recovery strategy (hot standby / warm standby / cold standby / backup restore / manual workaround)
2. Required infrastructure and resources
3. Recovery procedure outline (key steps)
4. Testing and validation approach
5. Cost-benefit considerations

Respond in structured markdown with clear headings per asset.`;

    const result = await generateText({
      model,
      system:
        'You are an IT disaster recovery architect. Provide practical recovery strategies considering RTO/RPO targets and cost-effectiveness.',
      prompt,
      maxOutputTokens: providerConfig.maxTokens,
      temperature: 0.4,
    });

    return result.text;
  }
}

export const aiSuggestionService = new AISuggestionService();
