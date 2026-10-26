import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { testDbConnection } from '../db/index.js';

export const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const handler = async (request: any, reply: any) => {
    const dbHealth = await testDbConnection(2, 1000);

    const uptimeSeconds = Math.floor(process.uptime());
    const timestamp = new Date().toISOString();

    if (!dbHealth.configured) {
      return reply.status(200).send({
        status: 'pending_configuration',
        database: 'not_configured',
        message: 'Backend is running. Waiting for TURSO_DATABASE_URL in backend/.env',
        timestamp,
        uptimeSeconds,
        instruction: 'Paste your Turso database URL in backend/.env and restart.',
      });
    }

    if (dbHealth.connected) {
      return reply.status(200).send({
        status: 'healthy',
        database: 'connected',
        databaseLatencyMs: dbHealth.latencyMs,
        timestamp,
        uptimeSeconds,
        message: 'All systems operational. Turso (libSQL) database connected.',
      });
    }

    // Degraded / DB unreachable
    return reply.status(503).send({
      status: 'degraded',
      database: 'disconnected',
      error: dbHealth.error,
      timestamp,
      uptimeSeconds,
      message: 'Turso database is unreachable. Please retry in a few seconds.',
    });
  };

  fastify.get('/health', handler);
  fastify.get('/api/v1/health', handler);
};
