import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pool } from './client.js';

async function main() {
  const migrationsDir = new URL('../../drizzle/migrations', import.meta.url);
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  await pool.query('CREATE TABLE IF NOT EXISTS _resiliplan_migrations (name text PRIMARY KEY, applied_at timestamp NOT NULL DEFAULT now())');
  for (const file of files) {
    const existing = await pool.query('SELECT 1 FROM _resiliplan_migrations WHERE name = $1', [file]);
    if (existing.rowCount) {
      console.log(`skip ${file}`);
      continue;
    }
    const sql = await readFile(join(migrationsDir.pathname, file), 'utf8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _resiliplan_migrations(name) VALUES($1)', [file]);
      await pool.query('COMMIT');
      console.log(`applied ${file}`);
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  }
}

main()
  .then(async () => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
