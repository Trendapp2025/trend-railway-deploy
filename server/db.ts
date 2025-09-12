import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../shared/schema';
import dotenv from 'dotenv';

// Ensure env is loaded when run from scripts
dotenv.config({ path: '../.env' });

function getNormalizedDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^\[(.+)\]$/, '$1');
    const password = decodeURIComponent(u.password);
    return `${u.protocol}//${u.username}:${encodeURIComponent(password)}@${host}:${u.port}${u.pathname}${u.search}`;
  } catch {
    return raw; // fallback to provided string
  }
}

const pool = new Pool({
  connectionString: getNormalizedDatabaseUrl(),
});

export const db = drizzle(pool, { schema });

export { schema };