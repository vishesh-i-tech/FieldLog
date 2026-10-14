import { getItem, setItem, deleteItem } from './storage.service';
import { DEFAULT_API_BASE_URL } from '../constants/config';

export interface UserSession {
  id: string;
  organizationId: string;
  role: 'owner' | 'supervisor';
  name: string;
  email?: string;
  phone: string;
  language?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const STORAGE_KEY_USER = 'fieldlog_auth_user';
const STORAGE_KEY_TOKENS = 'fieldlog_auth_tokens';

let cachedUser: UserSession | null = null;
let cachedTokens: AuthTokens | null = null;
const listeners = new Set<(user: UserSession | null) => void>();

export async function initAuthSession(): Promise<UserSession | null> {
  try {
    const userJson = await getItem(STORAGE_KEY_USER);
    const tokensJson = await getItem(STORAGE_KEY_TOKENS);
    if (userJson && tokensJson) {
      cachedUser = JSON.parse(userJson);
      cachedTokens = JSON.parse(tokensJson);
      notifyListeners();
      return cachedUser;
    }
  } catch (err) {
    console.error('Failed to restore auth session:', err);
  }
  return null;
}

export function getCurrentUser(): UserSession | null {
  return cachedUser;
}

export function getAuthTokens(): AuthTokens | null {
  return cachedTokens;
}

export function subscribeAuth(callback: (user: UserSession | null) => void): () => void {
  listeners.add(callback);
  callback(cachedUser);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners() {
  listeners.forEach((listener) => listener(cachedUser));
}

export async function saveAuthSession(user: UserSession, tokens: AuthTokens): Promise<void> {
  cachedUser = user;
  cachedTokens = tokens;
  await setItem(STORAGE_KEY_USER, JSON.stringify(user));
  await setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens));
  notifyListeners();
}

export async function clearAuthSession(): Promise<void> {
  cachedUser = null;
  cachedTokens = null;
  await deleteItem(STORAGE_KEY_USER);
  await deleteItem(STORAGE_KEY_TOKENS);
  notifyListeners();
}

// 1. Owner Login
export async function loginOwner(email: string, password: string): Promise<UserSession> {
  const res = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/auth/owner/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Owner login failed');
  }

  await saveAuthSession(data.user, data.tokens);
  return data.user;
}

// 2. Owner Signup
export async function signupOwner(params: {
  companyName: string;
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<UserSession> {
  const res = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/auth/owner/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Owner sign up failed');
  }

  await saveAuthSession(data.user, data.tokens);
  return data.user;
}

// 3. Supervisor Login
export async function loginSupervisor(phone: string, pin: string): Promise<UserSession> {
  const res = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/auth/supervisor/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phone.trim(), pin: pin.trim() }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Supervisor login failed');
  }

  await saveAuthSession(data.user, data.tokens);
  return data.user;
}

// 4. Supervisor Signup
export async function signupSupervisor(params: {
  name: string;
  phone: string;
  pin: string;
  organizationId?: string;
}): Promise<UserSession> {
  const res = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/auth/supervisor/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Supervisor sign up failed');
  }

  await saveAuthSession(data.user, data.tokens);
  return data.user;
}
