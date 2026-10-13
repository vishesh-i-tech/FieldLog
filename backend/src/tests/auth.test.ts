import { test } from 'node:test';
import * as assert from 'node:assert';
import { buildServer } from '../server.js';
import { getDb } from '../db/index.js';
import { organizations, users } from '../db/schema.js';
import { eq, or } from 'drizzle-orm';

test('Phase 1 Auth & Roles: Full Multi-tenant Auth Lifecycle', async () => {
  const db = getDb();
  if (!db) {
    console.log('Skipping live DB auth test (DATABASE_URL not configured)');
    return;
  }

  const server = await buildServer();

  const ownerAEmail = `owner_a_${Date.now()}@fieldlog.test`;
  const ownerAPhone = `91${Math.floor(1000000000 + Math.random() * 9000000000)}`;

  const ownerBEmail = `owner_b_${Date.now()}@fieldlog.test`;
  const ownerBPhone = `91${Math.floor(1000000000 + Math.random() * 9000000000)}`;

  let ownerAToken = '';
  let ownerBToken = '';
  let orgAId = '';
  let orgBId = '';
  let supervisorAPhone = `91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  let supervisorAToken = '';
  let supervisorAId = '';

  try {
    // 1. Owner A Signup
    const signupARes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/owner/signup',
      payload: {
        companyName: 'Apex Builders A',
        name: 'Rajesh Contractor',
        email: ownerAEmail,
        phone: ownerAPhone,
        password: 'SecurePassword123!',
      },
    });
    assert.strictEqual(signupARes.statusCode, 201);
    const signupAData = JSON.parse(signupARes.payload);
    assert.ok(signupAData.tokens.accessToken);
    assert.ok(signupAData.tokens.refreshToken);
    assert.strictEqual(signupAData.user.role, 'owner');
    ownerAToken = signupAData.tokens.accessToken;
    orgAId = signupAData.organization.id;

    // Verify 6 default issue chips were automatically seeded for Org A
    const orgAIssuesRes = await server.inject({
      method: 'GET',
      url: '/api/v1/issue-types',
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(orgAIssuesRes.statusCode, 200);
    const issuesData = JSON.parse(orgAIssuesRes.payload);
    assert.strictEqual(issuesData.issueTypes.length, 6);

    // 2. Owner B Signup
    const signupBRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/owner/signup',
      payload: {
        companyName: 'Bharat Retail B',
        name: 'Vikram Shop Owner',
        email: ownerBEmail,
        phone: ownerBPhone,
        password: 'PasswordB456!',
      },
    });
    assert.strictEqual(signupBRes.statusCode, 201);
    const signupBData = JSON.parse(signupBRes.payload);
    ownerBToken = signupBData.tokens.accessToken;
    orgBId = signupBData.organization.id;

    // 3. Owner A Login with correct and incorrect password
    const wrongPassRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/owner/login',
      payload: { email: ownerAEmail, password: 'WrongPassword' },
    });
    assert.strictEqual(wrongPassRes.statusCode, 401);

    const validLoginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/owner/login',
      payload: { email: ownerAEmail, password: 'SecurePassword123!' },
    });
    assert.strictEqual(validLoginRes.statusCode, 200);

    // 4. Owner A creates a Supervisor with 4-digit PIN
    const createSupRes = await server.inject({
      method: 'POST',
      url: '/api/v1/supervisors',
      headers: { authorization: `Bearer ${ownerAToken}` },
      payload: {
        name: 'Ramesh Mistri',
        phone: supervisorAPhone,
        pin: '4321',
        language: 'hi',
      },
    });
    assert.strictEqual(createSupRes.statusCode, 201);
    const createSupData = JSON.parse(createSupRes.payload);
    supervisorAId = createSupData.supervisor.id;
    assert.strictEqual(createSupData.supervisor.role, 'supervisor');

    // 5. Supervisor A Login with 4-digit PIN
    const supLoginWrongPin = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/supervisor/login',
      payload: { phone: supervisorAPhone, pin: '0000' },
    });
    assert.strictEqual(supLoginWrongPin.statusCode, 401);

    const supLoginValid = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/supervisor/login',
      payload: { phone: supervisorAPhone, pin: '4321' },
    });
    assert.strictEqual(supLoginValid.statusCode, 200);
    const supLoginData = JSON.parse(supLoginValid.payload);
    assert.ok(supLoginData.tokens.accessToken);
    supervisorAToken = supLoginData.tokens.accessToken;

    // 6. Token Refresh
    const refreshRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: supLoginData.tokens.refreshToken },
    });
    assert.strictEqual(refreshRes.statusCode, 200);
    const refreshData = JSON.parse(refreshRes.payload);
    assert.ok(refreshData.tokens.accessToken);

    // 7. Role Guard: Supervisor cannot access Owner-only routes
    const forbiddenRes = await server.inject({
      method: 'GET',
      url: '/api/v1/supervisors',
      headers: { authorization: `Bearer ${supervisorAToken}` },
    });
    assert.strictEqual(forbiddenRes.statusCode, 403);
    const forbiddenData = JSON.parse(forbiddenRes.payload);
    assert.strictEqual(forbiddenData.code, 'FORBIDDEN_ROLE');

    // 8. Multi-Tenant Guard: Owner B cannot see or modify Owner A's supervisors
    const ownerBListSupervisors = await server.inject({
      method: 'GET',
      url: '/api/v1/supervisors',
      headers: { authorization: `Bearer ${ownerBToken}` },
    });
    assert.strictEqual(ownerBListSupervisors.statusCode, 200);
    const ownerBListData = JSON.parse(ownerBListSupervisors.payload);
    // Owner B must have 0 supervisors
    assert.strictEqual(ownerBListData.supervisors.length, 0);

    // Owner B cannot reset Supervisor A's PIN
    const crossTenantPinReset = await server.inject({
      method: 'PATCH',
      url: `/api/v1/supervisors/${supervisorAId}/pin`,
      headers: { authorization: `Bearer ${ownerBToken}` },
      payload: { pin: '9999' },
    });
    assert.strictEqual(crossTenantPinReset.statusCode, 404);

    // 9. Supervisor Deactivation
    const deactRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/supervisors/${supervisorAId}/status`,
      headers: { authorization: `Bearer ${ownerAToken}` },
      payload: { isActive: false },
    });
    assert.strictEqual(deactRes.statusCode, 200);

    // Deactivated supervisor cannot log in
    const loginDeactivated = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/supervisor/login',
      payload: { phone: supervisorAPhone, pin: '4321' },
    });
    assert.strictEqual(loginDeactivated.statusCode, 403);
  } finally {
    // Cleanup test data
    if (orgAId) await db.delete(organizations).where(eq(organizations.id, orgAId));
    if (orgBId) await db.delete(organizations).where(eq(organizations.id, orgBId));
  }
});
