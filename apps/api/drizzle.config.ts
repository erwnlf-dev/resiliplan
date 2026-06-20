import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./src/db/schema/tenants.ts', './src/db/schema/users.ts', './src/db/schema/drp.ts'],
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://resiliplan:dev@localhost:5432/resiliplan',
  },
  verbose: true,
  strict: true,
});
