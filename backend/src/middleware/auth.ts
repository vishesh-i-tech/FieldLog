import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, AuthTokenPayload } from '../services/auth.service.js';

// Extend FastifyRequest interface to include authenticated user
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthTokenPayload;
  }
}

/**
 * Validates the JWT Bearer token and attaches user payload to request.user.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected Bearer token.',
      code: 'AUTH_REQUIRED',
    });
  }

  const token = authHeader.substring(7).trim();
  try {
    const payload = verifyAccessToken(token);
    request.user = payload;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message,
      code: 'TOKEN_INVALID',
    });
  }
}

/**
 * Middleware guard ensuring caller has Owner role.
 */
export async function requireOwner(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    await authenticate(request, reply);
    if (reply.sent) return;
  }

  if (request.user?.role !== 'owner') {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Access restricted to business Owners only.',
      code: 'FORBIDDEN_ROLE',
    });
  }
}

/**
 * Middleware guard ensuring caller has Supervisor role.
 */
export async function requireSupervisor(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    await authenticate(request, reply);
    if (reply.sent) return;
  }

  if (request.user?.role !== 'supervisor') {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Access restricted to Supervisors only.',
      code: 'FORBIDDEN_ROLE',
    });
  }
}
