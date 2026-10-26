import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { sites, siteAssignments, users } from '../db/schema.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

const createSiteSchema = z.object({
  name: z.string().min(2, 'Work place name is required').max(255),
  locationText: z.string().min(2, 'Location description is required'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const updateSiteSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  locationText: z.string().min(2).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isArchived: z.boolean().optional(),
});

const assignSupervisorsSchema = z.object({
  supervisorIds: z.array(z.string().uuid()).min(1, 'At least one supervisor ID is required'),
});

export const siteRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // All site routes require authentication
  fastify.addHook('preHandler', authenticate);

  // 1. List Sites / Work Places
  // If Owner: returns all org sites
  // If Supervisor: returns ONLY assigned sites
  fastify.get('/api/v1/sites', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const user = request.user!;
    const { includeArchived } = request.query as { includeArchived?: string };

    if (user.role === 'owner') {
      const conditions = [eq(sites.organizationId, user.organizationId)];
      if (includeArchived !== 'true') {
        conditions.push(eq(sites.isArchived, false));
      }

      const allSites = await db
        .select()
        .from(sites)
        .where(and(...conditions));

      // Fetch assignments for each site
      const siteIds = allSites.map((s) => s.id);
      let assignmentsMap: Record<string, { id: string; name: string; phone: string }[]> = {};

      if (siteIds.length > 0) {
        const assignments = await db
          .select({
            siteId: siteAssignments.siteId,
            userId: users.id,
            name: users.name,
            phone: users.phone,
          })
          .from(siteAssignments)
          .innerJoin(users, eq(siteAssignments.userId, users.id))
          .where(inArray(siteAssignments.siteId, siteIds));

        for (const item of assignments) {
          if (!assignmentsMap[item.siteId]) assignmentsMap[item.siteId] = [];
          assignmentsMap[item.siteId].push({
            id: item.userId,
            name: item.name,
            phone: item.phone,
          });
        }
      }

      const formatted = allSites.map((s) => ({
        ...s,
        assignedSupervisors: assignmentsMap[s.id] || [],
      }));

      return reply.status(200).send({ sites: formatted });
    }

    // Role: Supervisor -> strictly assigned sites only
    const assignedRows = await db
      .select({
        id: sites.id,
        organizationId: sites.organizationId,
        name: sites.name,
        locationText: sites.locationText,
        latitude: sites.latitude,
        longitude: sites.longitude,
        isArchived: sites.isArchived,
        createdAt: sites.createdAt,
      })
      .from(sites)
      .innerJoin(siteAssignments, eq(sites.id, siteAssignments.siteId))
      .where(
        and(
          eq(sites.organizationId, user.organizationId),
          eq(sites.isArchived, false),
          eq(siteAssignments.userId, user.userId)
        )
      );

    return reply.status(200).send({ sites: assignedRows });
  });

  // 2. Get Single Site / Work Place
  fastify.get('/api/v1/sites/:id', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const user = request.user!;
    const { id } = request.params as { id: string };

    const [site] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, id), eq(sites.organizationId, user.organizationId)));

    if (!site) {
      return reply.status(404).send({ error: 'Work place not found in your organization' });
    }

    if (user.role === 'supervisor') {
      // Ensure supervisor is assigned
      const [assignment] = await db
        .select()
        .from(siteAssignments)
        .where(and(eq(siteAssignments.siteId, id), eq(siteAssignments.userId, user.userId)));

      if (!assignment) {
        return reply.status(403).send({ error: 'You are not assigned to this work place' });
      }
    }

    return reply.status(200).send({ site });
  });

  // 3. Create Site (Owner Only)
  fastify.post('/api/v1/sites', { preHandler: [requireOwner] }, async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const user = request.user!;
    const parsed = createSiteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }

    const [created] = await db
      .insert(sites)
      .values({
        organizationId: user.organizationId,
        name: parsed.data.name,
        locationText: parsed.data.locationText,
        latitude: parsed.data.latitude ? Number(parsed.data.latitude) : null,
        longitude: parsed.data.longitude ? Number(parsed.data.longitude) : null,
      })
      .returning();

    return reply.status(201).send({ site: created });
  });

  // 4. Update / Archive Site (Owner Only)
  fastify.patch('/api/v1/sites/:id', { preHandler: [requireOwner] }, async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const user = request.user!;
    const { id } = request.params as { id: string };

    const parsed = updateSiteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }

    // Verify site belongs to owner's organization
    const [existing] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, id), eq(sites.organizationId, user.organizationId)));

    if (!existing) {
      return reply.status(404).send({ error: 'Work place not found in your organization' });
    }

    const updatePayload: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
    if (parsed.data.locationText !== undefined) updatePayload.locationText = parsed.data.locationText;
    if (parsed.data.isArchived !== undefined) updatePayload.isArchived = parsed.data.isArchived;
    if (parsed.data.latitude !== undefined) updatePayload.latitude = Number(parsed.data.latitude);
    if (parsed.data.longitude !== undefined) updatePayload.longitude = Number(parsed.data.longitude);

    const [updated] = await db
      .update(sites)
      .set(updatePayload)
      .where(and(eq(sites.id, id), eq(sites.organizationId, user.organizationId)))
      .returning();

    return reply.status(200).send({ site: updated });
  });

  // 5. Assign Supervisors to Site (Owner Only)
  fastify.post('/api/v1/sites/:id/assign', { preHandler: [requireOwner] }, async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const user = request.user!;
    const { id } = request.params as { id: string };

    const parsed = assignSupervisorsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }

    // Ensure site belongs to owner's org
    const [site] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, id), eq(sites.organizationId, user.organizationId)));

    if (!site) {
      return reply.status(404).send({ error: 'Work place not found in your organization' });
    }

    // Validate that all supervisor IDs belong to this organization
    const validSupervisors = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.organizationId, user.organizationId),
          eq(users.role, 'supervisor'),
          inArray(users.id, parsed.data.supervisorIds)
        )
      );

    if (validSupervisors.length !== parsed.data.supervisorIds.length) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'One or more supervisor IDs are invalid or belong to a different organization.',
      });
    }

    // Insert assignments, skipping duplicates
    for (const sup of validSupervisors) {
      const [existing] = await db
        .select()
        .from(siteAssignments)
        .where(and(eq(siteAssignments.siteId, id), eq(siteAssignments.userId, sup.id)));

      if (!existing) {
        await db.insert(siteAssignments).values({
          siteId: id,
          userId: sup.id,
        });
      }
    }

    return reply.status(200).send({
      message: 'Supervisors assigned successfully.',
      siteId: id,
      assignedCount: validSupervisors.length,
    });
  });

  // 6. Remove Supervisor Assignment from Site (Owner Only)
  fastify.delete('/api/v1/sites/:id/assign/:userId', { preHandler: [requireOwner] }, async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const user = request.user!;
    const { id, userId } = request.params as { id: string; userId: string };

    // Ensure site belongs to owner's org
    const [site] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, id), eq(sites.organizationId, user.organizationId)));

    if (!site) {
      return reply.status(404).send({ error: 'Work place not found in your organization' });
    }

    await db
      .delete(siteAssignments)
      .where(and(eq(siteAssignments.siteId, id), eq(siteAssignments.userId, userId)));

    return reply.status(200).send({ message: 'Supervisor unassigned successfully.' });
  });
};
