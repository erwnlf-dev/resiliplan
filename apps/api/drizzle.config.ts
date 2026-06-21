import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/db/schema/tenants.ts',
    './src/db/schema/users.ts',
    './src/db/schema/drp.ts',
    './src/db/schema/resilience.ts',
    './src/db/schema/bia.ts',
    './src/db/schema/comments.ts',
    './src/db/schema/ai.ts',
    './src/db/schema/billing.ts',
    './src/db/schema/email.ts',
    './src/db/schema/integrations.ts',
  ],
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://resiliplan:***@localhost:5432/resiliplan',
  },
  verbose: true,
  strict: true,
});
