# DRPBuilder — AI Integration Design

> Deep dive ke AI provider abstraction, prompt engineering, dan cost control.

## 1. Goals

DRPBuilder AI harus:
1. **Multi-provider** — OpenAI, Anthropic, OpenAI-compatible, Anthropic-compatible, custom URL
2. **BYO API key** — user bisa pakai key sendiri (privacy & cost)
3. **Streaming** — real-time UX, time-to-first-token < 2s
4. **Cost-aware** — token tracking, budget alert, hard stop
5. **Context-aware** — prompt di-inject dengan plan, asset, BIA, dependencies
6. **Best-practice aware** — reference NIST/ISO controls, recovery patterns
7. **Multi-language** — ID + EN, switchable per request

## 2. Provider Configuration Model

### 2.1 Per-Org Config

User bisa configure multiple AI provider di org level. Setiap provider punya:

```typescript
type AIProviderConfig = {
  id: string;                          // 'apc_xxx'
  tenant_id: string;                   // 't_xxx'
  name: string;                        // 'Production OpenAI', 'Local Llama'
  provider:
    | 'openai'                         // api.openai.com
    | 'anthropic'                      // api.anthropic.com
    | 'openai-compatible'              // Together, Groq, OpenRouter, llama.cpp, vLLM
    | 'anthropic-compatible';          // custom Anthropic-format endpoint

  api_key_encrypted: string;           // AES-256-GCM encrypted
  base_url?: string;                   // for '*-compatible' only
  default_model: string;               // 'gpt-4o', 'claude-sonnet-4-5', 'llama-3.1-70b'
  fallback_model?: string;             // used if default fails
  organization?: string;               // OpenAI org ID
  default_headers?: Record<string, string>;  // corporate gateway headers
  is_default: boolean;                 // org default
  enabled: boolean;
  settings_json: {
    temperature?: number;              // default 0.3 (factual)
    max_tokens?: number;               // per request cap
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
  };
  created_at: string;
  updated_at: string;
};
```

### 2.2 Encryption

API key di-encrypt dengan AES-256-GCM:
- Master key dari env: `API_KEY_ENCRYPTION_KEY` (32 bytes random)
- Per-record IV (12 bytes random)
- Auth tag (16 bytes)
- Stored format: `iv:authTag:ciphertext` (base64)
- Decrypted only at request time, never logged

### 2.3 Test Connection

Before saving, user bisa test connection:
- Send minimal request (`max_tokens=5`) to provider
- Verify response
- Show latency + model info
- If fail, show error reason (auth, rate limit, model not found, etc)

## 3. Provider Abstraction Layer

### 3.1 Factory

```typescript
// apps/api/src/services/ai/provider-factory.ts
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelV1 } from 'ai';

export type AIProviderConfig = {
  provider: 'openai' | 'anthropic' | 'openai-compatible' | 'anthropic-compatible';
  apiKey: string;
  baseURL?: string;
  model: string;
  organization?: string;
  defaultHeaders?: Record<string, string>;
};

export function createAIModel(config: AIProviderConfig): LanguageModelV1 {
  switch (config.provider) {
    case 'openai':
    case 'openai-compatible': {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,  // undefined = default OpenAI endpoint
        organization: config.organization,
        headers: config.defaultHeaders,
      });
      return openai(config.model);
    }

    case 'anthropic':
    case 'anthropic-compatible': {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        headers: config.defaultHeaders,
      });
      return anthropic(config.model);
    }
  }
}
```

### 3.2 Why Vercel AI SDK

| Feature | Vercel AI SDK | LangChain | Direct HTTP |
|---|---|---|---|
| Multi-provider native | ✅ | ✅ (but heavy) | ❌ manual |
| Streaming | ✅ (SSE) | ✅ | ✅ (manual) |
| Type safety | ✅ TypeScript | ⚠️ partial | ❌ |
| Function calling | ✅ | ✅ | ⚠️ provider-specific |
| Structured output | ✅ (Zod) | ✅ | ⚠️ |
| Bundle size | ~30KB | ~500KB+ | 0 (manual) |
| Maintain burden | Low | High | High |

**Decision:** Vercel AI SDK adalah sweet spot untuk DRPBuilder. Lower bundle, native streaming, type-safe, official.

## 4. Prompt Templates

### 4.1 Structure per Section

```typescript
// apps/api/src/services/ai/prompts/index.ts
export type SectionPrompt = {
  system: string;
  buildContext: (plan: Plan, section: Section, asset?: Asset) => Record<string, unknown>;
  buildUserPrompt: (ctx: Record<string, unknown>) => string;
  outputFormat: 'markdown' | 'structured' | 'json';
  maxTokens: number;
  temperature: number;
};
```

### 4.2 Example: Executive Summary

```typescript
{
  system: `Anda adalah konsultan senior Disaster Recovery & Business Continuity dengan 15+ tahun pengalaman.
Tulis executive summary DRP yang:
- 1 paragraf padat, maximum 200 kata
- Bahasa formal profesional Indonesia
- Cover: tujuan, scope, key recovery targets (RTO/RPO), recovery strategy, status approval
- Tidak ada jargon berlebihan
- Action-oriented, bukan descriptive

Format output: Markdown tanpa heading.`,

  buildContext: (plan) => ({
    planName: plan.name,
    serviceType: plan.service_type,
    description: plan.description,
    criticalityTier: plan.tier,
    rtoMinutes: plan.rto_minutes,
    rpoMinutes: plan.rpo_minutes,
    recoveryStrategy: plan.recovery_strategy,
    approver: plan.approved_by_name,
    approvalDate: plan.approved_at,
  }),

  buildUserPrompt: (ctx) => `Buat executive summary untuk DRP:

Nama DRP: ${ctx.planName}
Service: ${ctx.serviceType}
Deskripsi: ${ctx.description}
Tier Kritikalitas: ${ctx.criticalityTier} (Tier 1 = paling kritis)
RTO target: ${ctx.rtoMinutes} menit
RPO target: ${ctx.rpoMinutes} menit
Recovery strategy: ${ctx.recoveryStrategy}
Status: Approved oleh ${ctx.approver} pada ${ctx.approvalDate}

Tulis 1 paragraf, maximum 200 kata.`,

  outputFormat: 'markdown',
  maxTokens: 400,
  temperature: 0.3,
}
```

### 4.3 Example: Recovery Procedure

```typescript
{
  system: `Anda adalah SRE/DevOps senior yang ahli dalam disaster recovery.
Buat step-by-step recovery procedure yang:
- Numbered list (1, 2, 3, ...)
- Tiap step imperative + verifiable: "Verify X dengan command Y"
- Include expected duration per step (e.g., "±5 menit")
- Include rollback per phase jika gagal
- Reference specific commands (bukan generic "jalankan script")
- Untuk service database: include pre-flight check (replication lag, disk space, connection pool)
- Untuk web application: include DNS cutover, SSL cert verification, health check endpoint
- Sesuaikan tone dengan technical audience (engineer on-call)

Format output: Markdown dengan heading dan numbered list.`,

  buildContext: (plan, section, asset) => ({
    serviceType: plan.service_type,
    strategy: plan.recovery_strategy,
    platform: asset?.platform,
    techStack: asset?.tech_stack || [],
    dependencies: asset?.dependencies || [],
    drSite: plan.dr_site_location,
    rtoMinutes: plan.rto_minutes,
  }),

  buildUserPrompt: (ctx) => `Buat recovery procedure untuk:

Service: ${ctx.serviceType}
Strategy: ${ctx.strategy}
Platform: ${ctx.platform}
Tech stack: ${ctx.techStack.join(', ')}
Dependencies: ${ctx.dependencies.join(', ')}
DR site: ${ctx.drSite}
Target RTO: ${ctx.rtoMinutes} menit

Procedure harus detail dan executable. Include:
1. Pre-flight check (validasi state sebelum mulai)
2. Main recovery steps (ordered by criticality)
3. Validation (verify service is up & healthy)
4. Rollback per phase (jika gagal)`,

  outputFormat: 'markdown',
  maxTokens: 2000,
  temperature: 0.4,
}
```

### 4.4 Consistency Check (different mode)

```typescript
{
  system: `Anda adalah auditor DRP senior.
Review DRP section yang diberikan, identify INTERNAL INCONSISTENCY:
- RTO/RPO declared vs implied di procedure
- Strategy vs procedure steps
- Assumptions vs actual capability
- Tier vs recovery target
- Referenced section ID vs actual sections

Output format: JSON array of issues:
[{
  "severity": "high" | "medium" | "low",
  "section_id": "...",
  "issue": "RTO di Section 3 (60 menit) tidak match dengan total procedure time di Section 7 (90 menit)",
  "suggestion": "Tambah parallel recovery step atau naikkan RTO target"
}]`,

  buildContext: (plan, sections) => ({
    plan: plan,
    sections: sections.map(s => ({
      id: s.id,
      title: s.title,
      content: s.content.slice(0, 4000),  // truncate for context
    })),
  }),

  buildUserPrompt: (ctx) => `Review DRP "${ctx.plan.name}" untuk consistency.

Sections:
${ctx.sections.map(s => `[${s.id}] ${s.title}\n${s.content}\n---\n`).join('\n')}

Output JSON array of issues, max 10 issues.`,

  outputFormat: 'json',
  maxTokens: 1500,
  temperature: 0.2,
}
```

## 5. Streaming Implementation

### 5.1 Backend (Fastify)

```typescript
// apps/api/src/routes/ai/draft-section.ts
import { streamText } from 'ai';
import { z } from 'zod';

const BodySchema = z.object({
  planId: z.string(),
  sectionId: z.string(),
  aiConfigId: z.string().optional(),  // org default if not specified
  stream: z.boolean().default(true),
});

export async function draftSectionHandler(req, reply) {
  const { planId, sectionId, aiConfigId, stream } = BodySchema.parse(req.body);
  const tenantId = req.user.tenantId;

  // Load context
  const plan = await planService.getPlan(tenantId, planId);
  const section = await planService.getSection(tenantId, sectionId);
  const asset = plan.asset_id ? await assetService.getAsset(tenantId, plan.asset_id) : null;
  const aiConfig = await aiService.getConfig(tenantId, aiConfigId);

  // Build prompt
  const prompt = sectionPrompts[section.template_key];
  if (!prompt) {
    return reply.code(400).send({ error: `No prompt template for ${section.template_key}` });
  }

  const ctx = prompt.buildContext(plan, section, asset);
  const userPrompt = prompt.buildUserPrompt(ctx);

  // Create model
  const model = createAIModel({
    provider: aiConfig.provider,
    apiKey: aiService.decryptKey(aiConfig.api_key_encrypted),
    baseURL: aiConfig.base_url,
    model: aiConfig.default_model,
    organization: aiConfig.organization,
    defaultHeaders: aiConfig.default_headers,
  });

  // Start streaming
  const result = streamText({
    model,
    system: prompt.system,
    prompt: userPrompt,
    temperature: prompt.temperature,
    maxTokens: prompt.maxTokens,
    onFinish: async (result) => {
      await aiService.logUsage({
        tenantId,
        userId: req.user.id,
        planId,
        sectionId,
        provider: aiConfig.provider,
        model: aiConfig.default_model,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        costUsd: estimateCost(aiConfig.default_model, result.usage),
      });
    },
    onError: (error) => {
      log.error({ err: error, planId, sectionId }, 'AI stream error');
    },
  });

  return result.toDataStreamResponse();
}
```

### 5.2 Frontend (TanStack Query + streaming)

```typescript
// apps/web/src/api/ai.ts
import { useMutation } from '@tanstack/react-query';

export function useDraftSection(planId: string) {
  return useMutation({
    mutationFn: async ({ sectionId, onChunk }: { sectionId: string; onChunk: (chunk: string) => void }) => {
      const response = await fetch(`${API_URL}/ai/draft-section`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ planId, sectionId, stream: true }),
      });

      if (!response.ok) throw new Error(`AI request failed: ${response.status}`);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            try {
              const parsed = JSON.parse(data);
              const chunk = parsed.choices?.[0]?.delta?.content || parsed.text || '';
              if (chunk) onChunk(chunk);
            } catch (e) {
              // ignore parse error mid-stream
            }
          }
        }
      }
    },
  });
}
```

```tsx
// apps/web/src/components/editor/AIDraftButton.tsx
export function AIDraftButton({ planId, sectionId }: Props) {
  const [content, setContent] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const draftSection = useDraftSection(planId);

  const handleGenerate = async () => {
    setIsDrafting(true);
    setContent('');
    try {
      await draftSection.mutateAsync({
        sectionId,
        onChunk: (chunk) => setContent((c) => c + chunk),
      });
    } catch (err) {
      toast.error(`AI draft failed: ${err.message}`);
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <>
      <Button onClick={handleGenerate} disabled={isDrafting}>
        {isDrafting ? <Spinner /> : <SparklesIcon />}
        {isDrafting ? 'AI is drafting...' : 'Generate with AI'}
      </Button>
      {content && (
        <Card>
          <PreviewContent content={content} />
          <ButtonGroup>
            <Button onClick={() => acceptDraft(content)}>Accept</Button>
            <Button variant="ghost" onClick={() => setContent('')}>Discard</Button>
          </ButtonGroup>
        </Card>
      )}
    </>
  );
}
```

## 6. Cost Tracking

### 6.1 Pricing (per 1M tokens, USD, mid-2026)

| Model | Input | Output |
|---|---|---|
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| claude-sonnet-4-5 | $3.00 | $15.00 |
| claude-haiku-3-5 | $0.80 | $4.00 |
| llama-3.1-70b (Together) | $0.88 | $0.88 |
| llama-3.1-8b (Together) | $0.18 | $0.18 |

### 6.2 Estimator

```typescript
// apps/api/src/services/ai/cost-estimator.ts
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'claude-sonnet-4-5': { input: 3.00, output: 15.00 },
  'claude-haiku-3-5': { input: 0.80, output: 4.00 },
  // ...
};

export function estimateCost(model: string, usage: { promptTokens: number; completionTokens: number }): number {
  const price = PRICING[model] || { input: 1.0, output: 3.0 };  // safe default
  return (usage.promptTokens / 1_000_000) * price.input +
         (usage.completionTokens / 1_000_000) * price.output;
}
```

### 6.3 Budget Guard

```typescript
// apps/api/src/middleware/ai-budget-guard.ts
export async function aiBudgetGuard(req, reply) {
  const tenantId = req.user.tenantId;
  const usage = await aiService.getMonthUsage(tenantId);
  const limit = await billingService.getAILimit(tenantId);

  if (usage.costUsd >= limit.costUsd) {
    return reply.code(429).send({
      error: 'AI budget exceeded',
      message: `Org AI budget ${limit.costUsd} USD reached. Either wait until next month or upgrade.`,
      usage,
    });
  }

  // Warn at 80%
  if (usage.costUsd >= limit.costUsd * 0.8) {
    reply.header('X-AI-Budget-Warning', `80% of monthly budget used (${usage.costUsd}/${limit.costUsd} USD)`);
  }
}
```

## 7. Failure Modes & Fallback

| Failure | Detection | Fallback |
|---|---|---|
| Auth fail (401) | Provider response | Show error, suggest check API key |
| Rate limit (429) | Provider response | Retry with exp backoff (3x), then show error |
| Timeout (>30s) | Client timeout | Cancel stream, show error, suggest smaller context |
| Model not found (404) | Provider response | Try fallback_model if configured |
| Network error | Connection reset | Show error with retry button |
| Content moderation (400) | Provider response | Show error, suggest rephrase input |
| All providers fail | All retries exhausted | Allow manual edit, log to error tracker |

## 8. Privacy & Compliance

### 8.1 Data Flow

```
User input → Frontend (HTTPS) → API (auth + RLS) → AI Provider (HTTPS)
                                              ↓
                                         Audit log + Token log
                                              ↓
                                         DB (encrypted at rest)
```

### 8.2 BYO Key vs Default Key

| Aspect | Default Key (DRPBuilder-hosted) | BYO Key |
|---|---|---|
| Provider | OpenAI / Anthropic | Any |
| Data sharing | Subject to provider's data policy (OpenAI may log) | Direct, no intermediary |
| Cost | Included in plan or metered | User pays provider directly |
| Privacy | Lower (third-party data flow) | Higher |

### 8.3 Disclosure

- Privacy policy clearly state: when using default key, AI request may be logged by provider
- Allow user to opt-out of default key (force BYO)
- Show "data sent to AI" indicator during AI request

### 8.4 Data Minimization

- Only send section context, not full DRP unless needed
- Strip PII (email, phone) from context before sending (Phase 2+)
- No training: configure providers to not train on API data (OpenAI API: "Do not train on API data" already default)

## 9. Observability

### 9.1 Per-Request Log

```json
{
  "traceId": "trace_abc123",
  "tenantId": "t_xxx",
  "userId": "u_xxx",
  "sectionId": "sec_xxx",
  "provider": "openai",
  "model": "gpt-4o",
  "promptTokens": 1245,
  "completionTokens": 380,
  "totalTokens": 1625,
  "durationMs": 4250,
  "ttftMs": 920,
  "costUsd": 0.0069,
  "status": "success",
  "errorCode": null
}
```

### 9.2 Aggregated Metrics (per tenant per day)

- Request count, success rate
- Total tokens, cost
- Avg latency (TTFT, total)
- Top section types
- Top models used

## 10. Future Enhancements

1. **AI agent for proactive review** — scheduled job, scan all DRPs, flag outdated
2. **Fine-tuned model** — train small model on DRP-specific corpus (cost optimization)
3. **Local LLM support** — Ollama integration for air-gapped org
4. **Multi-modal** — analyze diagram (recovery architecture) uploaded as image
5. **Voice** — voice-to-DRP for interview-style BIA
6. **Translation** — auto-translate DRP to multi-language

---

**Last updated:** 2026-06-20
