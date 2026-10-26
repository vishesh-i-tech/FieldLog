import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import * as dotenv from 'dotenv';
import * as os from 'os';
import { healthRoutes } from './routes/health.js';
import { versionRoutes } from './routes/version.js';
import { issueTypeRoutes } from './routes/issueTypes.js';
import { authRoutes } from './routes/auth.js';
import { supervisorRoutes } from './routes/supervisors.js';
import { siteRoutes } from './routes/sites.js';
import { devStorageRoutes } from './routes/devStorage.js';
import { uploadRoutes } from './routes/uploads.js';
import { recordRoutes } from './routes/records.js';

dotenv.config();

const port = parseInt(process.env.PORT || '4000', 10);
const host = process.env.HOST || '0.0.0.0';

export async function buildServer() {
  const server = Fastify({
    logger: true,
    bodyLimit: 50 * 1024 * 1024, // 50MB body limit for geotagged photos and audio uploads
  });

  // Configure CORS: permissive for development (localhost / Expo web), strict in production
  const isDev = process.env.NODE_ENV !== 'production';
  await server.register(cors, {
    origin: isDev
      ? true // Allow localhost:8081, dev browser, and mobile clients in dev
      : (origin, cb) => {
          // Allow https origins or localhost for development/preview testing
          if (!origin || origin.startsWith('https://') || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
            cb(null, true);
            return;
          }
          cb(new Error('CORS origin denied'), false);
        },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Register sensible utilities for standard HTTP errors
  await server.register(sensible);

  // Register Routes
  await server.register(healthRoutes);
  await server.register(versionRoutes);
  await server.register(issueTypeRoutes);
  await server.register(authRoutes);
  await server.register(supervisorRoutes);
  await server.register(siteRoutes);
  await server.register(devStorageRoutes);
  await server.register(uploadRoutes);
  await server.register(recordRoutes);

  // Root welcome route
  server.get('/', async () => {
    return {
      app: 'FieldLog API',
      version: '0.1.0',
      healthUrl: '/health',
      versionUrl: '/version',
      docs: '/docs',
    };
  });

  return server;
}

// Helper to find local IPv4 network address for easy mobile testing
function getLocalIpAddress(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

async function start() {
  try {
    const server = await buildServer();
    await server.listen({ port, host });

    const localIps = getLocalIpAddress();
    console.log('\n======================================================');
    console.log(`🚀 FieldLog API is running!`);
    console.log(`   Local URL:    http://localhost:${port}`);
    if (localIps.length > 0) {
      console.log(`   LAN/Phone IP: http://${localIps[0]}:${port}`);
      console.log(`   Health Check: http://${localIps[0]}:${port}/health`);
    }
    console.log('======================================================\n');
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

// Run directly if this is the main module
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  start();
}
