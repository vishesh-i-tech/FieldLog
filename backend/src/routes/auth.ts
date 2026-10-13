import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, or } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { organizations, users } from '../db/schema.js';
import {
  hashPassword,
  verifyPassword,
  verifyPin,
  generateTokens,
  verifyRefreshToken,
} from '../services/auth.service.js';
import { seedDefaultIssueTypes } from '../services/issueTypes.service.js';
import { authenticate } from '../middleware/auth.js';

const ownerSignupSchema = z.object({
  companyName: z.string().min(2, 'Company name is required').max(255),
  name: z.string().min(2, 'Name is required').max(255),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(8, 'Valid phone number is required').max(32),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

const ownerLoginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

const supervisorLoginSchema = z.object({
  phone: z.string().min(8, 'Phone number is required').max(32),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. Owner Signup
  fastify.post('/api/v1/auth/owner/signup', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const parsed = ownerSignupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message || 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const { companyName, name, email, phone, password } = parsed.data;

    // Check existing user by email or phone
    const [existing] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, email.toLowerCase()), eq(users.phone, phone)));

    if (existing) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: existing.email === email.toLowerCase()
          ? 'An account with this email already exists'
          : 'An account with this phone number already exists',
        code: 'USER_EXISTS',
      });
    }

    // 1. Create Organization
    const [org] = await db
      .insert(organizations)
      .values({ name: companyName })
      .returning();

    // 2. Hash password & Create Owner User
    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({
        organizationId: org.id,
        role: 'owner',
        name,
        email: email.toLowerCase(),
        phone,
        passwordHash,
        language: 'hi',
        isActive: true,
      })
      .returning({
        id: users.id,
        organizationId: users.organizationId,
        role: users.role,
        name: users.name,
        email: users.email,
        phone: users.phone,
        language: users.language,
      });

    // 3. Seed 6 default issue types for the organization
    await seedDefaultIssueTypes(org.id);

    // 4. Generate Auth Tokens
    const tokens = generateTokens({
      userId: user.id,
      organizationId: user.organizationId,
      role: 'owner',
      name: user.name,
    });

    return reply.status(201).send({
      user,
      organization: org,
      tokens,
    });
  });

  // 2. Owner Login (Email + Password)
  fastify.post('/api/v1/auth/owner/login', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const parsed = ownerLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }

    const { email, password } = parsed.data;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (!user || user.role !== 'owner' || !user.passwordHash) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (!user.isActive) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Account has been deactivated. Please contact support.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Update last login timestamp
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const tokens = generateTokens({
      userId: user.id,
      organizationId: user.organizationId,
      role: 'owner',
      name: user.name,
    });

    return reply.status(200).send({
      user: {
        id: user.id,
        organizationId: user.organizationId,
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone,
        language: user.language,
      },
      tokens,
    });
  });

  // 3. Supervisor Login (Phone + 4-digit PIN)
  fastify.post('/api/v1/auth/supervisor/login', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const parsed = supervisorLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }

    const { phone, pin } = parsed.data;

    const [supervisor] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone));

    if (!supervisor || supervisor.role !== 'supervisor' || !supervisor.pinHash) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'फ़ोन नंबर या 4-अंकों का पिन गलत है (Invalid phone or PIN)',
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (!supervisor.isActive) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'यह अकाउंट बंद कर दिया गया है (Supervisor account is deactivated)',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    const isPinValid = await verifyPin(pin, supervisor.pinHash);
    if (!isPinValid) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'फ़ोन नंबर या 4-अंकों का पिन गलत है (Invalid phone or PIN)',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Update last login timestamp
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, supervisor.id));

    const tokens = generateTokens({
      userId: supervisor.id,
      organizationId: supervisor.organizationId,
      role: 'supervisor',
      name: supervisor.name,
    });

    return reply.status(200).send({
      user: {
        id: supervisor.id,
        organizationId: supervisor.organizationId,
        role: supervisor.role,
        name: supervisor.name,
        phone: supervisor.phone,
        language: supervisor.language,
      },
      tokens,
    });
  });

  // 4. Token Refresh
  fastify.post('/api/v1/auth/refresh', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const parsed = refreshTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Refresh token is required',
      });
    }

    try {
      const payload = verifyRefreshToken(parsed.data.refreshToken);

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId));

      if (!user || !user.isActive) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'User session is no longer active',
          code: 'USER_INACTIVE',
        });
      }

      const freshTokens = generateTokens({
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
        name: user.name,
      });

      return reply.status(200).send({
        tokens: freshTokens,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: msg,
        code: 'REFRESH_TOKEN_INVALID',
      });
    }
  });

  // 5. Get Current User Profile (Authenticated)
  fastify.get('/api/v1/auth/me', { preHandler: [authenticate] }, async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const [user] = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        role: users.role,
        name: users.name,
        email: users.email,
        phone: users.phone,
        language: users.language,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, request.user!.userId));

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.organizationId));

    return reply.status(200).send({
      user,
      organization: org,
    });
  });
};
