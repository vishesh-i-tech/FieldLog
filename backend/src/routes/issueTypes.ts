import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, count } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { issueTypes } from '../db/schema.js';
import { getIssueTypesForOrg } from '../services/issueTypes.service.js';
import { verifyAccessToken } from '../services/auth.service.js';

const createIssueTypeSchema = z.object({
  labelHi: z.string().min(1, 'Hindi label is required').max(255),
  labelEn: z.string().min(1, 'English label is required').max(255),
  icon: z.string().max(64).optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const updateIssueTypeSchema = z.object({
  labelHi: z.string().min(1).max(255).optional(),
  labelEn: z.string().min(1).max(255).optional(),
  icon: z.string().max(64).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const issueTypeRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Pre-handler hook to parse Bearer token if provided
  fastify.addHook('preHandler', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        request.user = verifyAccessToken(token);
      } catch {
        return reply.status(401).send({ error: 'Unauthorized: invalid or expired token' });
      }
    }
  });

  // GET /api/v1/issue-types
  // Query param: ?activeOnly=true
  fastify.get('/api/v1/issue-types', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    // Organization ID from auth context or header for early phases/tests
    const orgId = (request as any).user?.organizationId || (request.headers['x-organization-id'] as string);
    if (!orgId) {
      return reply.status(401).send({ error: 'Unauthorized: organization context required' });
    }

    const { activeOnly } = request.query as { activeOnly?: string };
    const isSupervisor = (request as any).user?.role === 'supervisor' || activeOnly === 'true';

    const items = await getIssueTypesForOrg(orgId, isSupervisor);
    return reply.status(200).send({ issueTypes: items });
  });

  // POST /api/v1/issue-types (Owner only)
  fastify.post('/api/v1/issue-types', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const orgId = (request as any).user?.organizationId || (request.headers['x-organization-id'] as string);
    if (!orgId) {
      return reply.status(401).send({ error: 'Unauthorized: organization context required' });
    }

    const parsed = createIssueTypeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    // Check maximum active visible chips (max 8)
    if (parsed.data.isActive) {
      const [activeResult] = await db
        .select({ val: count() })
        .from(issueTypes)
        .where(and(eq(issueTypes.organizationId, orgId), eq(issueTypes.isActive, true)));

      if (Number(activeResult?.val || 0) >= 8) {
        return reply.status(400).send({
          error: 'Maximum 8 active issue chips allowed. Deactivate or hide an existing chip first.',
        });
      }
    }

    const [created] = await db
      .insert(issueTypes)
      .values({
        organizationId: orgId,
        labelHi: parsed.data.labelHi,
        labelEn: parsed.data.labelEn,
        icon: parsed.data.icon,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
        isDefault: false,
      })
      .returning();

    return reply.status(201).send({ issueType: created });
  });

  // PATCH /api/v1/issue-types/:id (Owner only)
  fastify.patch('/api/v1/issue-types/:id', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const orgId = (request as any).user?.organizationId || (request.headers['x-organization-id'] as string);
    if (!orgId) {
      return reply.status(401).send({ error: 'Unauthorized: organization context required' });
    }

    const { id } = request.params as { id: string };
    const parsed = updateIssueTypeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    // Ensure the issue type belongs to this organization
    const [existing] = await db
      .select()
      .from(issueTypes)
      .where(and(eq(issueTypes.id, id), eq(issueTypes.organizationId, orgId)));

    if (!existing) {
      return reply.status(404).send({ error: 'Issue type not found in this organization' });
    }

    // If activating, check 8 active limit
    if (parsed.data.isActive === true && !existing.isActive) {
      const [activeResult] = await db
        .select({ val: count() })
        .from(issueTypes)
        .where(and(eq(issueTypes.organizationId, orgId), eq(issueTypes.isActive, true)));

      if (Number(activeResult?.val || 0) >= 8) {
        return reply.status(400).send({
          error: 'Maximum 8 active issue chips allowed. Deactivate another chip first.',
        });
      }
    }

    const [updated] = await db
      .update(issueTypes)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(and(eq(issueTypes.id, id), eq(issueTypes.organizationId, orgId)))
      .returning();

    return reply.status(200).send({ issueType: updated });
  });
};
