import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'fieldlog-super-secret-key-change-in-production-min32chars!';
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '30d';

export interface AuthTokenPayload {
  userId: string;
  organizationId: string;
  role: 'owner' | 'supervisor';
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashPin(pin: string): Promise<string> {
  // Validate 4 digits
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN must be exactly 4 digits');
  }
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export function generateTokens(payload: AuthTokenPayload): AuthTokens {
  const accessToken = jwt.sign(
    {
      userId: payload.userId,
      organizationId: payload.organizationId,
      role: payload.role,
      name: payload.name,
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    {
      userId: payload.userId,
      organizationId: payload.organizationId,
      role: payload.role,
      name: payload.name,
      type: 'refresh',
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return {
    accessToken,
    refreshToken,
    expiresInSeconds: 3600, // 1 hour
  };
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    return {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      role: decoded.role,
      name: decoded.name,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Authentication token invalid or expired: ${msg}`);
  }
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      role: decoded.role,
      name: decoded.name,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Refresh token invalid or expired: ${msg}`);
  }
}
