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
  PlanSkeletonRequest,
  StrategyRecommendationRequest,
  RecoveryStepsRequest,
  TestScenariosRequest,
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
   * Now supports a `mode` parameter for specialized output: draft | improve | steps | test | comms | escalation.
   */
  async streamSuggestion(tenantId: string, request: AISuggestionRequest) {
    const providerConfig = await aiProviderService.getActiveProvider(tenantId);
    if (!providerConfig) {
      throw new Error('No active AI provider configured for this tenant. Add one in Settings > AI Providers.');
    }

    const model = this.createModel(providerConfig);

    const modeInstructions: Record<string, string> = {
      draft: 'Draft initial content for this section. Use clear headings, lists, and tables. Reference ISO 22301 clauses. Be specific to the service and recovery targets provided.',
      improve: 'Analyze the existing content and improve it. Keep what works, add missing details, fix gaps in roles, contacts, RTO/RPO, evidence. Do not invent facts that contradict the existing content.',
      steps: 'Generate an ordered, numbered list of recovery steps with: preconditions, owner role, time target, verification gate. Steps must collectively meet the RTO target.',
      test: 'Generate test scenarios for this section. Include scenario name, type (tabletop/walkthrough/component/full DR), acceptance criteria, and how to verify.',
      comms: 'Generate communication templates: status page update, internal Slack, customer email, executive brief. Use the placeholders appropriate for each audience.',
      escalation: 'Generate a tiered escalation tree with named roles, response time targets, primary and backup contacts, and the conditions that trigger each tier.',
    };
    const modeInstruction = modeInstructions[request.mode ?? 'draft'] ?? modeInstructions.draft;
    const headerBits: string[] = [];
    if (request.serviceName) headerBits.push(`Service: ${request.serviceName}`);
    if (request.rtoMinutes) headerBits.push(`RTO: ${request.rtoMinutes} minutes`);
    if (request.rpoMinutes) headerBits.push(`RPO: ${request.rpoMinutes} minutes`);
    if (request.criticality) headerBits.push(`Criticality: ${request.criticality}`);
    const header = headerBits.length ? `\n${headerBits.join(' | ')}` : '';

    const systemPrompt = `You are an expert in ISO 22301 Business Continuity Management and Disaster Recovery Planning.
You help organizations write clear, compliant DR plan sections.
Section: ${request.section}${header}
${request.context ? `\nContext about this organization:\n${request.context}` : ''}

Task mode: ${modeInstruction}

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

  /**
   * Generate a complete DR plan skeleton — drafts content for all 14 ISO 22301 sections.
   * Each section is generated in a single large response; sections are separated by `=== SECTION: <key> ===` markers.
   */
  async generatePlanSkeleton(tenantId: string, request: PlanSkeletonRequest) {
    const providerConfig = await aiProviderService.getActiveProvider(tenantId);
    if (!providerConfig) {
      throw new Error('No active AI provider configured for this tenant.');
    }
    const model = this.createModel(providerConfig);

    const assetList = request.assets?.length
      ? request.assets.map((a) => `- ${a.name}${a.type ? ` (${a.type})` : ''}${a.criticality ? ` [${a.criticality}]` : ''}`).join('\n')
      : '(none provided)';
    const biaList = request.biaEntries?.length
      ? request.biaEntries.map((b) => `- ${b.process} (1h=${b.impact1h ?? '?'}/5, 4h=${b.impact4h ?? '?'}/5, 24h=${b.impact24h ?? '?'}/5, RTO=${b.rtoMinutes ?? '?'}m, RPO=${b.rpoMinutes ?? '?'}m)`).join('\n')
      : '(none provided)';

    const systemPrompt = `You are an expert ISO 22301 Business Continuity consultant writing a complete Disaster Recovery Plan skeleton.
You produce a single response that drafts all 14 standard sections, separated by clear markers so the system can parse each section into the plan editor.

The 14 sections to draft (in this order):
1. context — scope, purpose, audience
2. roles — RACI for plan owner, incident commander, on-call, approver
3. objectives — RTO/RPO, success criteria
4. risk — top risks, mitigations, residual risk
5. strategy — high-level recovery strategy rationale
6. communication — comms plan, audiences, cadence
7. activation — criteria and authority to declare disaster
8. recovery — detailed step-by-step recovery procedure
9. restoration — return-to-normal procedure
10. dependencies — upstream/downstream systems, vendors
11. testing — quarterly test schedule
12. training — who is trained, frequency
13. maintenance — review cycle, ownership
14. appendix — references, glossary, change log

Format strictly: each section starts with a line '=== SECTION: <key> ===' then the markdown content, then a blank line, then the next section.
Keep each section 80-180 words. Be specific to the service provided.
Use tables, bullet lists, and ISO clause references where appropriate.`;

    const userPrompt = `Service name: ${request.serviceName}
${request.serviceOwner ? `Service owner: ${request.serviceOwner}` : ''}
Criticality: ${request.criticality ?? 'unspecified'}
RTO target: ${request.rtoMinutes} minutes
RPO target: ${request.rpoMinutes} minutes
${request.description ? `Service description: ${request.description}` : ''}

Known assets:
${assetList}

Known BIA processes:
${biaList}

Draft all 14 sections now. Use the exact format with === SECTION: <key> === markers.`;

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: Math.max(providerConfig.maxTokens, 4096),
      temperature: 0.5,
    });
    return result.text ?? '';
  }

  /**
   * Recommend a recovery strategy given RTO/RPO and asset/BIA context.
   * Returns a structured recommendation with rationale, infrastructure needs, and cost tier.
   */
  async recommendStrategy(tenantId: string, request: StrategyRecommendationRequest) {
    const providerConfig = await aiProviderService.getActiveProvider(tenantId);
    if (!providerConfig) {
      throw new Error('No active AI provider configured for this tenant.');
    }
    const model = this.createModel(providerConfig);

    const assetList = request.assets?.length
      ? request.assets.map((a) => `- ${a.name}${a.type ? ` (${a.type})` : ''}${a.criticality ? ` [${a.criticality}]` : ''}`).join('\n')
      : '(none provided)';
    const biaList = request.biaEntries?.length
      ? request.biaEntries.map((b) => `- ${b.process} (RTO=${b.rtoMinutes ?? '?'}m, RPO=${b.rpoMinutes ?? '?'}m)`).join('\n')
      : '(none provided)';

    const systemPrompt = `You are a senior IT DR architect. Given the RTO/RPO targets, asset inventory, BIA processes, and budget tier, recommend the most appropriate recovery strategy.

Recovery strategy options (use these exact names):
- hot-standby: Active-active multi-region, near-zero RTO (minutes), zero RPO. Highest cost.
- warm-standby: Active-passive with periodic replication, RTO 1-4 hours, RPO 5-15 minutes. Moderate cost.
- pilot-light: Minimal always-on core (DB replication), spin up full stack on demand, RTO 1-8 hours, RPO minutes-hours. Lower cost.
- backup-restore: Restore from backup, RTO 12-72 hours, RPO hours-days. Lowest cost.
- multi-region-active-active: Full active-active across regions, RTO near-zero, RPO zero. Highest cost, most complex.

Respond in strict JSON (no markdown code blocks, just the JSON object) with this shape:
{
  "primaryStrategy": "warm-standby",
  "secondaryStrategy": "backup-restore",
  "rationale": "2-3 sentences explaining why primary strategy fits the RTO/RPO and budget",
  "rtoRpoFit": "How the strategy meets (or doesn't) the RTO and RPO targets",
  "infrastructureNeeded": ["list of infra components: e.g. 'replicated DB in secondary region'", "load balancer", "DNS failover"],
  "estimatedCostTier": "minimal | moderate | aggressive",
  "monthlyCostRangeUSD": "rough range e.g. $500-$2000",
  "estimatedRtoMinutes": 60,
  "estimatedRpoMinutes": 15,
  "tradeoffs": ["list of tradeoffs the organization accepts"],
  "prerequisites": ["list of prerequisites: backup, monitoring, network, etc."]
}`;

    const userPrompt = `Service: ${request.serviceName}
${request.description ? `Description: ${request.description}` : ''}
Criticality: ${request.criticality ?? 'unspecified'}
RTO: ${request.rtoMinutes} minutes
RPO: ${request.rpoMinutes} minutes
Budget tier: ${request.budgetTier ?? 'moderate'}

Assets:
${assetList}

BIA processes:
${biaList}

Return strict JSON only. No prose, no markdown fences.`;

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 1500,
      temperature: 0.3,
    });
    return result.text ?? '';
  }

  /**
   * Generate ordered recovery steps for a service given RTO/RPO and strategy.
   */
  async generateRecoverySteps(tenantId: string, request: RecoveryStepsRequest) {
    const providerConfig = await aiProviderService.getActiveProvider(tenantId);
    if (!providerConfig) {
      throw new Error('No active AI provider configured for this tenant.');
    }
    const model = this.createModel(providerConfig);

    const systemPrompt = `You are a senior incident response and DR coordinator writing step-by-step recovery procedures.
Generate ${request.stepsCount} ordered steps that, executed in sequence, restore the service within the RTO target.

For each step, use this exact format:

**Step N: <verb-first title>** (target: <minute>m from T0)
- **Owner:** <role>
- **Preconditions:** <what must be true before starting>
- **Action:** <1-2 sentences describing what to do>
- **Verification:** <how to confirm this step succeeded>

The sequence must satisfy:
- Each step's target minutes must be monotonically non-decreasing
- The final step's target must be ≤ RTO
- Include pre-flight, failover/cutover, data restore, verification, and stand-down
- Use placeholders (e.g. <runbook link>, <phone>) for organization-specific values`;

    const userPrompt = `Service: ${request.serviceName}
${request.serviceDescription ? `Description: ${request.serviceDescription}` : ''}
RTO: ${request.rtoMinutes} minutes
RPO: ${request.rpoMinutes} minutes
${request.strategy ? `Recovery strategy: ${request.strategy}` : ''}
${request.existingSteps ? `\nExisting steps to refine:\n${request.existingSteps}` : ''}

Generate ${request.stepsCount} ordered steps now.`;

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: Math.max(providerConfig.maxTokens, 3000),
      temperature: 0.4,
    });
    return result.text ?? '';
  }

  /**
   * Generate a quarterly test schedule with concrete scenarios.
   */
  async generateTestScenarios(tenantId: string, request: TestScenariosRequest) {
    const providerConfig = await aiProviderService.getActiveProvider(tenantId);
    if (!providerConfig) {
      throw new Error('No active AI provider configured for this tenant.');
    }
    const model = this.createModel(providerConfig);

    const systemPrompt = `You are a DR test coordinator. Generate a quarterly test schedule (Q1-Q4) with concrete, runnable test scenarios.

For each quarter, output one scenario with this exact format:

### Q<n>: <Scenario title>
- **Type:** tabletop | walkthrough | component | partial-dr | full-dr
- **Scope:** <what is in scope>
- **Pre-conditions:** <what must be ready>
- **Procedure:** <3-5 numbered steps to run the test>
- **Success criteria:** <measurable outcomes>
- **Failure handling:** <what to do if test fails>

Aim for a mix: Q1 tabletop, Q2 component, Q3 partial-dr, Q4 full-dr unless the service cannot support that.
${request.existingTests ? `\nExisting tests (continue, expand, or replace as appropriate):\n${request.existingTests}` : ''}`;

    const userPrompt = `Service: ${request.serviceName}
${request.serviceDescription ? `Description: ${request.serviceDescription}` : ''}
${request.strategy ? `Recovery strategy: ${request.strategy}` : ''}

Generate Q1-Q4 test scenarios now.`;

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: Math.max(providerConfig.maxTokens, 2500),
      temperature: 0.4,
    });
    return result.text ?? '';
  }
}

export const aiSuggestionService = new AISuggestionService();
