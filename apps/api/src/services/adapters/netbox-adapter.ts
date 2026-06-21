/**
 * NetBox CMDB Adapter
 *
 * Pulls devices, services, circuits dari NetBox dan auto-populate BIA entries.
 * NetBox REST API: https://docs.netbox.dev/
 * Auth: Token header (Authorization: Token <api_token>)
 */
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { biaEntries } from '../../db/schema/bia.js';
import { logger } from '../../utils/logger.js';

type NetBoxConfig = {
  apiUrl: string;
  apiToken: string;
  verifyTls?: boolean;
  tagPrefix?: string;
  syncIntervalMinutes?: number;
};

type NetBoxDevice = {
  id: number;
  name: string;
  display: string;
  device_type?: { display: string };
  role?: { name: string; slug: string };
  site?: { name: string };
  status?: { value: string };
  tags?: Array<{ name: string; slug: string }>;
  primary_ip4?: { address: string };
  custom_fields?: Record<string, unknown>;
};

export async function runNetBoxSync(
  tenantId: string,
  config: NetBoxConfig,
): Promise<{ rowsAffected: number; rowsCreated: number; rowsUpdated: number; rowsSkipped: number; metadata?: Record<string, unknown> }> {
  const tagPrefix = config.tagPrefix || 'resiliplan';
  const headers = {
    'Authorization': `Token ${config.apiToken}`,
    'Accept': 'application/json',
  };

  // 1. Fetch devices tagged with our prefix
  const devicesUrl = `${config.apiUrl.replace(/\/$/, '')}/api/dcim/devices/?tag=${tagPrefix}&limit=100`;
  const resp = await fetch(devicesUrl, { headers });
  if (!resp.ok) {
    throw new Error(`NetBox API returned ${resp.status}: ${await resp.text()}`);
  }
  const data = (await resp.json()) as { results?: NetBoxDevice[] };
  const devices: NetBoxDevice[] = data.results || [];

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const device of devices) {
    if (!device.primary_ip4?.address) {
      skipped++;
      continue;
    }

    // Map NetBox role → ResiliPlan tier
    // Convention: tier1-critical, tier2-essential, tier3-important, tier4-standard
    const roleSlug = device.role?.slug?.toLowerCase() || '';
    let tier: 1 | 2 | 3 | 4 = 4;
    if (roleSlug.includes('tier1') || roleSlug.includes('critical')) tier = 1;
    else if (roleSlug.includes('tier2') || roleSlug.includes('essential')) tier = 2;
    else if (roleSlug.includes('tier3') || roleSlug.includes('important')) tier = 3;

    // Default RTO/RPO by tier (ISO 22301 typical)
    const rtoByTier = { 1: 60, 2: 240, 3: 480, 4: 1440 } as const;
    const rpoByTier = { 1: 15, 2: 60, 3: 240, 4: 1440 } as const;

    // Check if BIA entry already exists (by IP + tenant)
    const existing = await db
      .select()
      .from(biaEntries)
      .where(eq(biaEntries.tenantId, tenantId))
      .limit(1000);

    const duplicate = existing.find((e) => {
      // Match by netbox device ID or primary IP embedded in dependencyNotes
      return (
        e.dependencyNotes.includes(`[netbox:${device.id}]`) ||
        (!!device.primary_ip4?.address && e.dependencyNotes.includes(`ip=${device.primary_ip4.address}`)) ||
        // Also match by service name (exact) to avoid duplicate imports
        e.serviceName === device.name
      );
    });

    const metadataRecord = `[netbox:${device.id}] role=${device.role?.name || 'unspecified'}, ip=${device.primary_ip4?.address || 'unknown'}, synced=${new Date().toISOString()}`;

    if (duplicate) {
      // Update tier/RTO/RPO from NetBox (overwrite if NetBox value present)
      await db
        .update(biaEntries)
        .set({
          criticalityTier: `tier_${tier}` as 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4',
          currentRtoMinutes: rtoByTier[tier],
          currentRpoMinutes: rpoByTier[tier],
          // Store netbox provenance in dependencyNotes (jsonb not available)
          dependencyNotes: `[netbox:${device.id}] role=${device.role?.name || 'unspecified'}, ip=${device.primary_ip4.address}, synced=${new Date().toISOString()}`,
          updatedAt: new Date(),
        })
        .where(eq(biaEntries.id, duplicate.id));
      updated++;
    } else {
      // Create new BIA entry (only non-nullable fields, with sensible defaults)
      await db.insert(biaEntries).values({
        tenantId,
        serviceName: device.name,
        processName: device.device_type?.display || 'Unknown device type',
        owner: device.role?.name || 'unspecified',
        impact1h: tier === 1 ? 5 : tier === 2 ? 4 : tier === 3 ? 3 : 2,
        impact4h: tier === 1 ? 5 : tier === 2 ? 4 : tier === 3 ? 3 : 2,
        impact24h: tier === 1 ? 5 : tier === 2 ? 4 : tier === 3 ? 3 : 2,
        financialImpact: tier,
        reputationalImpact: tier,
        regulatoryImpact: tier,
        maxImpactScore: tier * 5,
        criticalityTier: `tier_${tier}` as 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4',
        currentRtoMinutes: rtoByTier[tier],
        currentRpoMinutes: rpoByTier[tier],
        dependencyNotes: `[netbox:${device.id}] role=${device.role?.name}, site=${device.site?.name || 'unknown'}, ip=${device.primary_ip4.address}, synced=${new Date().toISOString()}`,
        workaround: '',
      });
      created++;
    }
  }

  logger.info({ tenantId, devices: devices.length, created, updated, skipped }, 'NetBox sync complete');

  return {
    rowsAffected: created + updated,
    rowsCreated: created,
    rowsUpdated: updated,
    rowsSkipped: skipped,
    metadata: {
      source: 'netbox',
      devicesFound: devices.length,
      tagPrefix,
      syncedAt: new Date().toISOString(),
    },
  };
}
