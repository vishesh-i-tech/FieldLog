import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const versionRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/version', async () => {
    return {
      apiVersion: '0.1.0',
      minAppVersion: '1.0.0',
      latestAppVersion: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      forceUpdate: false,
      message: 'FieldLog API is up to date.',
      downloadUrl: null, // Populated in production with APK / Store link
    };
  });
};
