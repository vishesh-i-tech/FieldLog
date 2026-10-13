import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { testDbConnection } from '../db/index.js';

export const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/health', async (request, reply) => {
    const startTime = Date.now();
    const dbHealth = await testDbConnection(2, 1000);

    const uptimeSeconds = Math.floor(process.uptime());
    const timestamp = new Date().toISOString();

    if (!dbHealth.configured) {
      return reply.status(200).send({
        status: 'pending_configuration',
        database: 'not_configured',
        message: 'Backend is running. Waiting for Neon DATABASE_URL in backend/.env',
        timestamp,
        uptimeSeconds,
        instruction: 'Paste your Neon pooled connection string in backend/.env and restart.',
      });
    }

    if (dbHealth.connected) {
      return reply.status(200).send({
        status: 'healthy',
        database: 'connected',
        databaseLatencyMs: dbHealth.latencyMs,
        timestamp,
        uptimeSeconds,
        message: 'All systems operational. Neon Postgres connected.',
      });
    }

    // Degraded / DB waking up from cold start
    return reply.status(503).send({
      status: 'degraded',
      database: 'disconnected',
      error: dbHealth.error,
      timestamp,
      uptimeSeconds,
      message: 'Neon Postgres is waking up or unreachable. Please retry in a few seconds.',
    });
  });
};
