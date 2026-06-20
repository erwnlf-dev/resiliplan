import { eq } from 'drizzle-orm';
import { db, pool } from './client.js';
import { tenants, users } from './schema/index.js';
import { hashPassword } from '../auth/auth-service.js';

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@resiliplan.local';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!@#';

async function main() {
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: 'PT Datacomm Diangraha',
      slug: 'datacomm',
      settings: { defaultTemplate: 'iso-22301', isoStandards: ['ISO 22301:2019'], approvalRequired: true },
    })
    .onConflictDoUpdate({ target: tenants.slug, set: { name: 'PT Datacomm Diangraha', updatedAt: new Date() } })
    .returning();

  const existing = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (existing.length === 0) {
    await db.insert(users).values({
      tenantId: tenant.id,
      email: adminEmail,
      name: 'Erwin Alifiansyah',
      role: 'admin',
      passwordHash: await hashPassword(adminPassword),
      metadata: { department: 'IT Service Resilience', jobTitle: 'DR Coordinator' },
    });
    console.log(`Seeded admin user: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
