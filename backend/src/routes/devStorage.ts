import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';

export const devStorageRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const uploadDir = path.resolve(process.cwd(), './uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Accepts raw binary stream or JSON base64 dataUrl uploaded by client
  fastify.put('/api/v1/dev-storage/upload', async (request, reply) => {
    const key = (request.query as { key?: string })?.key;
    if (!key) {
      return reply.status(400).send({ error: 'Missing key query parameter' });
    }

    const safeKey = key.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const targetFile = path.join(uploadDir, safeKey);

    const buffer: any = await request.body;
    if (Buffer.isBuffer(buffer)) {
      fs.writeFileSync(targetFile, buffer);
    } else if (typeof buffer === 'string') {
      if (buffer.startsWith('data:image/')) {
        const base64Data = buffer.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(targetFile, Buffer.from(base64Data, 'base64'));
      } else {
        fs.writeFileSync(targetFile, buffer);
      }
    } else if (buffer && typeof buffer === 'object' && buffer.dataUrl) {
      if (typeof buffer.dataUrl === 'string' && buffer.dataUrl.startsWith('data:image/')) {
        const base64Data = buffer.dataUrl.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(targetFile, Buffer.from(base64Data, 'base64'));
      } else if (typeof buffer.dataUrl === 'string' && !buffer.dataUrl.startsWith('file:') && !buffer.dataUrl.startsWith('content:')) {
        try {
          fs.writeFileSync(targetFile, Buffer.from(buffer.dataUrl, 'base64'));
        } catch {
          fs.writeFileSync(targetFile, Buffer.from(''));
        }
      }
    } else {
      fs.writeFileSync(targetFile, JSON.stringify(buffer || ''));
    }

    return reply.status(200).send({
      message: 'File stored locally in dev storage.',
      storageKey: key,
      sizeBytes: fs.existsSync(targetFile) ? fs.statSync(targetFile).size : 0,
    });
  });

  // Serves uploaded file with accurate Content-Type
  fastify.get('/api/v1/dev-storage/files/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const safeKey = key.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const targetFile = path.join(uploadDir, safeKey);

    if (!fs.existsSync(targetFile)) {
      return reply.status(404).send({ error: 'File not found' });
    }

    const ext = path.extname(targetFile).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.m4a' || ext === '.mp4') mimeType = 'audio/mp4';
    else if (ext === '.webm') mimeType = 'audio/webm';

    const stream = fs.createReadStream(targetFile);
    return reply.type(mimeType).send(stream);
  });
};
