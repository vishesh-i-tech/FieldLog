import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getDb } from '../db/index.js';
import { sites, siteAssignments } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { storageProvider } from '../storage/index.js';

const presignSchema = z.object({
  siteId: z.string().uuid(),
  kind: z.enum(['photo', 'audio']),
  mimeType: z.string(),
});

export const uploadRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/api/v1/uploads/presign', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const user = request.user!;
    const parsed = presignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid upload request parameters',
        details: parsed.error.issues,
      });
    }

    const { siteId, kind, mimeType } = parsed.data;

    // Validate MIME types
    const allowedPhotoMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedAudioMimes = [
      'audio/m4a',
      'audio/mp4',
      'audio/aac',
      'audio/x-m4a',
      'audio/mpeg',
      'audio/webm',
      'audio/wav',
    ];

    if (kind === 'photo' && !allowedPhotoMimes.includes(mimeType.toLowerCase())) {
      return reply.status(400).send({
        error: 'Invalid photo MIME type. Only JPEG and PNG are permitted.',
      });
    }

    if (kind === 'audio' && !allowedAudioMimes.includes(mimeType.toLowerCase())) {
      return reply.status(400).send({
        error: 'Invalid audio MIME type. Only m4a/aac/mp4 audio are permitted.',
      });
    }

    // Verify site belongs to organization
    const [site] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.organizationId, user.organizationId)));

    if (!site) {
      return reply.status(404).send({ error: 'Work place not found in your organization' });
    }

    // If supervisor, verify assigned
    if (user.role === 'supervisor') {
      const [assignment] = await db
        .select()
        .from(siteAssignments)
        .where(and(eq(siteAssignments.siteId, siteId), eq(siteAssignments.userId, user.userId)));

      if (!assignment) {
        return reply.status(403).send({ error: 'You are not assigned to this work place' });
      }
    }

    // Construct unique storage key
    const dateStr = new Date().toISOString().split('T')[0];
    const extension = kind === 'photo' ? 'jpg' : 'm4a';
    const storageKey = `orgs/${user.organizationId}/sites/${siteId}/${dateStr}/${randomUUID()}.${extension}`;

    const presigned = await storageProvider.generatePresignedUploadUrl(storageKey, mimeType, 300);

    return reply.status(200).send({
      uploadUrl: presigned.uploadUrl,
      storageKey: presigned.storageKey,
      expiresInSeconds: presigned.expiresInSeconds,
    });
  });
};
