import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';
import * as dotenv from 'dotenv';

dotenv.config();

// Determine connection URL (Turso cloud or fallback to local SQLite file)
const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

let libsqlClient: Client | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

try {
  libsqlClient = createClient({
    url,
    authToken,
  });
  dbInstance = drizzle(libsqlClient, { schema });

  if (url.startsWith('file:')) {
    libsqlClient.execute('PRAGMA journal_mode = WAL;').catch(() => {});
    libsqlClient.execute('PRAGMA busy_timeout = 5000;').catch(() => {});
  }
} catch (err) {
  console.error('Failed to initialize Turso / libSQL client:', err);
}

export function getDb() {
  return dbInstance;
}

export function getSqlClient() {
  return libsqlClient;
}

export interface DbHealthResult {
  connected: boolean;
  configured: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Tests the database connection with automatic retry (tolerates transient network hiccups).
 */
export async function testDbConnection(retries = 2, delayMs = 1500): Promise<DbHealthResult> {
  if (!libsqlClient) {
    return {
      connected: false,
      configured: false,
      error: 'Turso/libSQL client is not initialized',
    };
  }

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const startTime = Date.now();
    try {
      await libsqlClient.execute('SELECT 1');
      const latencyMs = Date.now() - startTime;
      return {
        connected: true,
        configured: true,
        latencyMs,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (attempt <= retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        return {
          connected: false,
          configured: true,
          error: `Failed to connect to Turso/libSQL after ${attempt} attempts: ${errorMsg}`,
        };
      }
    }
  }

  return {
    connected: false,
    configured: false,
    error: 'Unknown database connection error',
  };
}
