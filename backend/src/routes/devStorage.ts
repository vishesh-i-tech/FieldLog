import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';

export const devStorageRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const uploadDir = path.resolve(process.cwd(), './uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Accepts raw binary stream uploaded by client
  fastify.put('/api/v1/dev-storage/upload', async (request, reply) => {
    const key = (request.query as { key?: string })?.key;
    if (!key) {
      return reply.status(400).send({ error: 'Missing key query parameter' });
    }

    const safeKey = key.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const targetFile = path.join(uploadDir, safeKey);

    const buffer = await request.body;
    if (Buffer.isBuffer(buffer)) {
      fs.writeFileSync(targetFile, buffer);
    } else {
      // In case body is passed as raw stream or object
      fs.writeFileSync(targetFile, JSON.stringify(buffer || ''));
    }

    return reply.status(200).send({
      message: 'File stored locally in dev storage stub.',
      storageKey: key,
      sizeBytes: fs.statSync(targetFile).size,
    });
  });

  // Serves uploaded file
  fastify.get('/api/v1/dev-storage/files/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const safeKey = key.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const targetFile = path.join(uploadDir, safeKey);

    if (!fs.existsSync(targetFile)) {
      return reply.status(404).send({ error: 'File not found' });
    }

    const stream = fs.createReadStream(targetFile);
    return reply.type('application/octet-stream').send(stream);
  });
};
