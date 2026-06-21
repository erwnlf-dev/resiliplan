/**
 * Acronis Cyber Protect Adapter
 *
 * Pulls protected resources dari Acronis (Datacomm Cloud Backup) dan:
 * 1. Auto-populate BIA entries dari protected workloads
 * 2. Map backup-eligible resources → service assets
 * 3. Track backup activity (RPO verification)
 * 4. Pull active alerts (RPO breach / failure detection)
 *
 * Scope: typically a single Acronis tenant unit (e.g. DCloud Ops numeric id 4804922).
 *
 * Acronis Cyber Protect REST API: https://developer.acronis.com/doc/cloud/21_12/manager/
 * Auth: OAuth2 client_credentials, token ~2h TTL.
 */
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { biaEntries } from '../../db/schema/bia.js';
import { logger } from '../../utils/logger.js';

type AcronisConfig = {
  // SaaS worker proxy (recommended) or direct Acronis API URL
  proxyUrl?: string; // e.g. http://127.0.0.1:4184/api/workers/acronis/query
  // Direct API (alternative)
  apiUrl?: string; // e.g. https://cloudbackup.datacomm.co.id
  clientId?: string; // OAuth2 client_id (only for direct)
  clientSecret?: string; // OAuth2 client_secret (only for direct)
  // Scope
  tenantId: string; // Acronis tenant UUID to audit (REQUIRED)
  // Filtering
  excludeResourceTypes?: string[]; // resource types to skip (org structure)
  excludeNamePatterns?: string[]; // regex/name patterns to skip
  // RPO
  rpoThresholdHours?: number; // default 24 (RPO breach if updated_at > threshold)
  // Mapping
  tagPrefix?: string; // only sync resources with this tag in user_defined_name or tags
};

type AcronisResource = {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  tenant_name?: string;
  name: string;
  user_defined_name?: string;
  type: string;
  parent_group_ids?: string[];
  has_members?: boolean;
  _linkIds?: string[];
  _links?: unknown[];
};

type AcronisAlert = {
  id: string;
  severity: 'warning' | 'error' | 'critical';
  state: 'active' | 'resolved';
  resource_id?: string;
  object_id?: string;
  type: string;
  title: string;
  created_at: string;
  resolved_at?: string;
};

const DEFAULT_EXCLUDE_TYPES = [
  'resource.group.*',
  'resource.virtual_center.vmwesx',
  'resource.virtual_data_center.vmwesx',
  'resource.virtual_cluster.vmwesx',
  'resource.virtual_folder.vmwesx',
  'resource.virtual_host.vmwesx',
  'resource.virtual_resource_pool.vmwesx',
  'resource.virtual_appliance.vmwesx',
];

const KEEP_TYPES = new Set([
  'resource.machine',
  'resource.virtual_machine.vmwesx',
  'resource.bootable_media',
  'resource.mssql_server',
  'resource.mssql_instance',
  'resource.mssql_database',
  'resource.virtual_application.vmwesx',
]);

export async function runAcronisSync(
  tenantId: string,
  config: AcronisConfig,
): Promise<{ rowsAffected: number; rowsCreated: number; rowsUpdated: number; rowsSkipped: number; metadata?: Record<string, unknown> }> {
  const rpoThresholdHours = config.rpoThresholdHours ?? 24;
  const tagPrefix = config.tagPrefix;

  // 1. List resources (via proxy or direct)
  const resources = await fetchAcronisResources(config);
  // 2. List active alerts
  const alerts = await fetchAcronisAlerts(config);

  const alertByResource = new Map<string, AcronisAlert>();
  for (const alert of alerts) {
    if (alert.state !== 'active') continue;
    if (alert.resource_id) alertByResource.set(alert.resource_id, alert);
    if (alert.object_id) alertByResource.set(alert.object_id, alert);
  }

  // 3. Filter resources
  const now = Date.now();
  const rpoThresholdMs = rpoThresholdHours * 60 * 60 * 1000;

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let rpoBreaches = 0;
  let failedResources = 0;

  // Pre-fetch existing BIA entries for duplicate detection
  const existing = await db.select().from(biaEntries).where(eq(biaEntries.tenantId, tenantId)).limit(2000);

  for (const resource of resources) {
    // Apply filters
    if (!KEEP_TYPES.has(resource.type)) {
      skipped++;
      continue;
    }
    if (config.excludeResourceTypes && config.excludeResourceTypes.includes(resource.type)) {
      skipped++;
      continue;
    }
    if (config.excludeNamePatterns) {
      const matches = config.excludeNamePatterns.some((p) => {
        try {
          return new RegExp(p, 'i').test(resource.name) || new RegExp(p, 'i').test(resource.user_defined_name || '');
        } catch {
          return false;
        }
      });
      if (matches) {
        skipped++;
        continue;
      }
    }
    if (tagPrefix) {
      const name = (resource.user_defined_name || resource.name).toLowerCase();
      if (!name.includes(tagPrefix.toLowerCase())) {
        skipped++;
        continue;
      }
    }

    const displayName = resource.user_defined_name || resource.name;
    const isBackupEligible = (resource._linkIds || []).includes('backup');
    const lastActivity = resource.updated_at ? new Date(resource.updated_at) : null;
    const ageHours = lastActivity ? (now - lastActivity.getTime()) / (60 * 60 * 1000) : Infinity;
    const isRpoBreach = ageHours > rpoThresholdHours;
    const hasAlert = alertByResource.has(resource.id);
    if (isRpoBreach) rpoBreaches++;
    if (hasAlert || !isBackupEligible) failedResources++;

    // Tier derivation:
    // - tier 1: critical (mssql_server, mssql_database, virtual_machine with name match 'tier1|critical')
    // - tier 2: essential (machine, virtual_machine)
    // - tier 3: important (virtual_application, bootable_media)
    // - tier 4: standard (rest)
    let tier: 1 | 2 | 3 | 4 = 4;
    if (resource.type === 'resource.mssql_database' || resource.type === 'resource.mssql_instance' || resource.type === 'resource.mssql_server') tier = 1;
    else if (resource.type === 'resource.machine' || resource.type === 'resource.virtual_machine.vmwesx') tier = 2;
    else if (resource.type === 'resource.virtual_application.vmwesx' || resource.type === 'resource.bootable_media') tier = 3;

    // RTO/RPO by tier
    const rtoByTier = { 1: 60, 2: 240, 3: 480, 4: 1440 } as const;
    const rpoByTier = { 1: 60, 2: 240, 3: 480, 4: 1440 } as const;

    // Duplicate detection: by resource id in dependencyNotes
    const provenanceTag = `[acronis:${resource.id}]`;

    // Find duplicate
    const duplicate = existing.find((e) => e.dependencyNotes.includes(provenanceTag));

    const provenance = `${provenanceTag} type=${resource.type}, lastActivity=${lastActivity?.toISOString() || 'never'}, backupEligible=${isBackupEligible}, synced=${new Date().toISOString()}`;

    if (duplicate) {
      await db
        .update(biaEntries)
        .set({
          criticalityTier: `tier_${tier}` as 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4',
          currentRtoMinutes: rtoByTier[tier],
          currentRpoMinutes: rpoByTier[tier],
          dependencyNotes: duplicate.dependencyNotes + '\n' + provenance,
          workaround: hasAlert
            ? `Active Acronis alert: ${alertByResource.get(resource.id)?.title}`
            : isRpoBreach
              ? `RPO breach: last backup ${ageHours.toFixed(1)}h ago (threshold ${rpoThresholdHours}h)`
              : duplicate.workaround,
          updatedAt: new Date(),
        })
        .where(eq(biaEntries.id, duplicate.id));
      updated++;
    } else {
      // Create new BIA entry
      // Impact fields are constrained 1-5
      const impact = Math.min(5, Math.max(1, tier + 2));
      await db.insert(biaEntries).values({
        tenantId,
        serviceName: displayName,
        processName: resource.type.replace('resource.', '').replace('.vmwesx', ''),
        owner: 'acronis-managed',
        impact1h: impact,
        impact4h: impact,
        impact24h: impact,
        financialImpact: Math.min(5, Math.max(1, tier)),
        reputationalImpact: Math.min(5, Math.max(1, tier)),
        regulatoryImpact: Math.min(5, Math.max(1, tier)),
        maxImpactScore: impact,
        criticalityTier: `tier_${tier}` as 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4',
        currentRtoMinutes: rtoByTier[tier],
        currentRpoMinutes: rpoByTier[tier],
        dependencyNotes: provenance,
        workaround: hasAlert
          ? `Active Acronis alert: ${alertByResource.get(resource.id)?.title}`
          : isRpoBreach
            ? `RPO breach: last backup ${ageHours.toFixed(1)}h ago (threshold ${rpoThresholdHours}h)`
            : 'Acronis backup active',
      });
      created++;
    }
  }

  logger.info(
    {
      tenantId,
      acronisTenant: config.tenantId,
      resources: resources.length,
      created,
      updated,
      skipped,
      rpoBreaches,
      failedResources,
      activeAlerts: alerts.filter((a) => a.state === 'active').length,
    },
    'Acronis sync complete',
  );

  return {
    rowsAffected: created + updated,
    rowsCreated: created,
    rowsUpdated: updated,
    rowsSkipped: skipped,
    metadata: {
      source: 'acronis',
      tenantId: config.tenantId,
      resourcesFound: resources.length,
      resourcesSynced: created + updated,
      resourcesSkipped: skipped,
      rpoBreaches,
      failedResources,
      activeAlerts: alerts.filter((a) => a.state === 'active').length,
      rpoThresholdHours,
      syncedAt: new Date().toISOString(),
    },
  };
}

async function fetchAcronisResources(config: AcronisConfig): Promise<AcronisResource[]> {
  if (config.proxyUrl) {
    // Use SaaS worker proxy (recommended — handles OAuth, token cache)
    const resp = await fetch(config.proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: 'list_resources',
        params: { tenant_id: config.tenantId, limit: 500 },
      }),
    });
    if (!resp.ok) {
      throw new Error(`Acronis proxy returned ${resp.status}: ${await resp.text()}`);
    }
    const data = (await resp.json()) as { ok: boolean; data?: { items?: AcronisResource[] }; error?: string };
    if (!data.ok) throw new Error(`Acronis proxy error: ${data.error}`);
    return data.data?.items || [];
  } else {
    throw new Error('Direct Acronis API not yet implemented. Use proxyUrl (SaaS worker proxy).');
  }
}

async function fetchAcronisAlerts(config: AcronisConfig): Promise<AcronisAlert[]> {
  if (config.proxyUrl) {
    const resp = await fetch(config.proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: 'list_alerts',
        params: { tenant_id: config.tenantId, state: 'active' },
      }),
    });
    if (!resp.ok) {
      throw new Error(`Acronis proxy alerts returned ${resp.status}: ${await resp.text()}`);
    }
    const data = (await resp.json()) as { ok: boolean; data?: { items?: AcronisAlert[] }; error?: string };
    if (!data.ok) throw new Error(`Acronis proxy alerts error: ${data.error}`);
    return data.data?.items || [];
  }
  return [];
}
