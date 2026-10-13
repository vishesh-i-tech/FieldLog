import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import * as dotenv from 'dotenv';
import * as os from 'os';
import { healthRoutes } from './routes/health.js';

dotenv.config();

const port = parseInt(process.env.PORT || '4000', 10);
const host = process.env.HOST || '0.0.0.0';

export async function buildServer() {
  const server = Fastify({
    logger: true,
  });

  // Enable CORS for mobile app requests
  await server.register(cors, {
    origin: true, // Allow all origins for dev / mobile client
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Register sensible utilities for standard HTTP errors
  await server.register(sensible);

  // Register Routes
  await server.register(healthRoutes);

  // Root welcome route
  server.get('/', async () => {
    return {
      app: 'DailyRecord API',
      version: '0.1.0',
      healthUrl: '/health',
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
    console.log(`🚀 DailyRecord API is running!`);
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
