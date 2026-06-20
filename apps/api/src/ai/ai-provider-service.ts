/**
 * AI Provider Service — BYO multi-provider support
 * Manages AI provider configurations per tenant with encrypted API keys.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { aiProviders } from '../db/schema/ai.js';
import type { AIProviderCreate, AIProviderUpdate } from './ai-types.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { randomUUID } from 'node:crypto';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export class AIProviderService {
  /**
   * Encrypt API key before storing in database.
   */
  private static encrypt(text: string): string {
    const key = Buffer.from(config.API_KEY_ENCRYPTION_KEY.slice(0, 32), 'utf8');
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt API key when retrieving from database.
   */
  private static decrypt(encryptedText: string): string {
    const key = Buffer.from(config.API_KEY_ENCRYPTION_KEY.slice(0, 32), 'utf8');
    const [ivHex, tagHex, encrypted] = encryptedText.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Get all AI providers for a tenant.
   */
  async listByTenant(tenantId: string) {
    const providers = await db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.tenantId, tenantId));

    return providers.map((p) => ({
      ...p,
      apiKey: '***', // Never expose API key in list
    }));
  }

  /**
   * Get a specific AI provider by ID.
   */
  async getById(id: string) {
    const [provider] = await db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.id, id));

    if (!provider) {
      return null;
    }

    return {
      ...provider,
      apiKey: AIProviderService.decrypt(provider.apiKey),
    };
  }

  /**
   * Get the active (enabled) AI provider for a tenant.
   */
  async getActiveProvider(tenantId: string) {
    const [provider] = await db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.tenantId, tenantId))
      .limit(1);

    if (!provider || !provider.enabled) {
      return null;
    }

    return {
      ...provider,
      apiKey: AIProviderService.decrypt(provider.apiKey),
    };
  }

  /**
   * Create a new AI provider configuration.
   */
  async create(tenantId: string, data: AIProviderCreate) {
    const now = new Date();
    const encryptedApiKey = AIProviderService.encrypt(data.apiKey);

    const [provider] = await db
      .insert(aiProviders)
      .values({
        id: randomUUID(),
        tenantId,
        provider: data.provider,
        apiKey: encryptedApiKey,
        model: data.model,
        maxTokens: data.maxTokens,
        temperature: data.temperature,
        enabled: data.enabled,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.info({ providerId: provider.id, provider: data.provider }, 'AI provider created');

    return {
      ...provider,
      apiKey: '***',
    };
  }

  /**
   * Update an AI provider configuration.
   */
  async update(id: string, data: AIProviderUpdate) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('AI provider not found');
    }

    const updateData: Partial<typeof aiProviders.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.provider !== undefined) updateData.provider = data.provider;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.maxTokens !== undefined) updateData.maxTokens = data.maxTokens;
    if (data.temperature !== undefined) updateData.temperature = data.temperature;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.apiKey !== undefined) {
      updateData.apiKey = AIProviderService.encrypt(data.apiKey);
    }

    const [updated] = await db
      .update(aiProviders)
      .set(updateData)
      .where(eq(aiProviders.id, id))
      .returning();

    logger.info({ providerId: id }, 'AI provider updated');

    return {
      ...updated,
      apiKey: '***',
    };
  }

  /**
   * Delete an AI provider configuration.
   */
  async delete(id: string) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('AI provider not found');
    }

    await db.delete(aiProviders).where(eq(aiProviders.id, id));

    logger.info({ providerId: id }, 'AI provider deleted');
  }
}

export const aiProviderService = new AIProviderService();
