import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPin } from '../services/auth.service.js';
import { requireOwner } from '../middleware/auth.js';

const createSupervisorSchema = z.object({
  name: z.string().min(2, 'Name is required').max(255),
  phone: z.string().min(8, 'Phone number is required').max(32),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
  language: z.enum(['hi', 'en']).default('hi'),
});

const resetPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

export const supervisorRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // All routes here strictly require Owner role
  fastify.addHook('preHandler', requireOwner);

  // 1. List Supervisors of Owner's Organization
  fastify.get('/api/v1/supervisors', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const orgId = request.user!.organizationId;

    const supervisorList = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        role: users.role,
        name: users.name,
        phone: users.phone,
        language: users.language,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.organizationId, orgId), eq(users.role, 'supervisor')));

    return reply.status(200).send({ supervisors: supervisorList });
  });

  // 2. Create Supervisor Account
  fastify.post('/api/v1/supervisors', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const orgId = request.user!.organizationId;
    const parsed = createSupervisorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message || 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const { name, phone, pin, language } = parsed.data;

    // Check if phone number already exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone));

    if (existing) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'A user with this phone number is already registered in the system.',
        code: 'PHONE_EXISTS',
      });
    }

    const pinHash = await hashPin(pin);

    const [created] = await db
      .insert(users)
      .values({
        organizationId: orgId,
        role: 'supervisor',
        name,
        phone,
        pinHash,
        language,
        isActive: true,
      })
      .returning({
        id: users.id,
        organizationId: users.organizationId,
        role: users.role,
        name: users.name,
        phone: users.phone,
        language: users.language,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return reply.status(201).send({ supervisor: created });
  });

  // 3. Reset Supervisor PIN
  fastify.patch('/api/v1/supervisors/:id/pin', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const orgId = request.user!.organizationId;
    const { id } = request.params as { id: string };

    const parsed = resetPinSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }

    // Ensure target supervisor belongs to caller's organization
    const [supervisor] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.organizationId, orgId), eq(users.role, 'supervisor')));

    if (!supervisor) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Supervisor not found in your organization.',
      });
    }

    const pinHash = await hashPin(parsed.data.pin);
    await db
      .update(users)
      .set({ pinHash, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id));

    return reply.status(200).send({
      message: 'Supervisor PIN reset successfully.',
    });
  });

  // 4. Activate / Deactivate Supervisor
  fastify.patch('/api/v1/supervisors/:id/status', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const orgId = request.user!.organizationId;
    const { id } = request.params as { id: string };

    const parsed = updateStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid status parameter',
      });
    }

    // Ensure target supervisor belongs to caller's organization
    const [supervisor] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.organizationId, orgId), eq(users.role, 'supervisor')));

    if (!supervisor) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Supervisor not found in your organization.',
      });
    }

    const [updated] = await db
      .update(users)
      .set({ isActive: parsed.data.isActive, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        phone: users.phone,
        isActive: users.isActive,
        updatedAt: users.updatedAt,
      });

    return reply.status(200).send({
      message: `Supervisor ${updated.isActive ? 'activated' : 'deactivated'} successfully.`,
      supervisor: updated,
    });
  });
};
