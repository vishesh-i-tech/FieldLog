import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

// Resilient Postgres client using connection pooler
let sqlClient: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (connectionString) {
  sqlClient = postgres(connectionString, {
    ssl: 'require',
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    // Neon scale-to-zero retry handler
    onnotice: () => {},
  });

  dbInstance = drizzle(sqlClient, { schema });
}

export function getDb() {
  return dbInstance;
}

export function getSqlClient() {
  return sqlClient;
}

export interface DbHealthResult {
  connected: boolean;
  configured: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Tests the database connection with automatic retry (tolerates Neon cold starts).
 */
export async function testDbConnection(retries = 2, delayMs = 1500): Promise<DbHealthResult> {
  if (!connectionString || !sqlClient) {
    return {
      connected: false,
      configured: false,
      error: 'DATABASE_URL is not set in backend/.env',
    };
  }

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const startTime = Date.now();
    try {
      // Simple lightweight query to check Neon responsiveness
      await sqlClient`SELECT 1`;
      const latencyMs = Date.now() - startTime;
      return {
        connected: true,
        configured: true,
        latencyMs,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (attempt <= retries) {
        // Wait before retrying (gives Neon a chance to wake up)
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        return {
          connected: false,
          configured: true,
          error: `Failed to connect to Neon after ${attempt} attempts: ${errorMsg}`,
        };
      }
    }
  }

  return {
    connected: false,
    configured: true,
    error: 'Unknown database connection error',
  };
}
