import { test } from 'node:test';
import * as assert from 'node:assert';
import { buildServer } from '../server.js';
import { getDb } from '../db/index.js';
import { organizations, issueTypes } from '../db/schema.js';
import { seedDefaultIssueTypes } from '../services/issueTypes.service.js';
import { eq } from 'drizzle-orm';

test('Issue Types: Multi-tenant isolation and 8-chip limit', async () => {
  const db = getDb();
  if (!db) {
    // If running in environment without live DB configured, skip gracefully
    console.log('Skipping live DB issueTypes test (DATABASE_URL not configured)');
    return;
  }

  const server = await buildServer();

  // Create two distinct test organizations
  const [orgA] = await db
    .insert(organizations)
    .values({ name: 'Test Org Alpha' })
    .returning();

  const [orgB] = await db
    .insert(organizations)
    .values({ name: 'Test Org Beta' })
    .returning();

  try {
    // Seed Org A with defaults
    await seedDefaultIssueTypes(orgA.id);

    // Seed Org B with a custom chip
    const [orgBChip] = await db
      .insert(issueTypes)
      .values({
        organizationId: orgB.id,
        labelHi: 'ऑर्ग बी की समस्या',
        labelEn: 'Org B Custom Issue',
        sortOrder: 1,
        isActive: true,
      })
      .returning();

    // 1. Unauthenticated request fails
    const noAuthRes = await server.inject({
      method: 'GET',
      url: '/api/v1/issue-types',
    });
    assert.strictEqual(noAuthRes.statusCode, 401);

    // 2. Org A can only see Org A's chips
    const orgARes = await server.inject({
      method: 'GET',
      url: '/api/v1/issue-types',
      headers: { 'x-organization-id': orgA.id },
    });
    assert.strictEqual(orgARes.statusCode, 200);
    const orgAData = JSON.parse(orgARes.payload);
    assert.strictEqual(orgAData.issueTypes.length, 6);
    // Org A must NOT see Org B's chip
    assert.strictEqual(
      orgAData.issueTypes.some((item: any) => item.labelEn === 'Org B Custom Issue'),
      false
    );

    // 3. Org A cannot edit Org B's chip
    const maliciousEditRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/issue-types/${orgBChip.id}`,
      headers: { 'x-organization-id': orgA.id },
      payload: { labelEn: 'Hacked by Org A' },
    });
    // Must return 404 Not Found because Org A has no access to Org B's chip
    assert.strictEqual(maliciousEditRes.statusCode, 404);

    // 4. Max 8 active chips check for Org A
    // Org A already has 6 chips. Add chip 7 and chip 8.
    await server.inject({
      method: 'POST',
      url: '/api/v1/issue-types',
      headers: { 'x-organization-id': orgA.id },
      payload: { labelHi: 'चिप ७', labelEn: 'Chip 7', sortOrder: 7, isActive: true },
    });
    await server.inject({
      method: 'POST',
      url: '/api/v1/issue-types',
      headers: { 'x-organization-id': orgA.id },
      payload: { labelHi: 'चिप ८', labelEn: 'Chip 8', sortOrder: 8, isActive: true },
    });

    // Attempting to add a 9th active chip must fail with 400
    const chip9Res = await server.inject({
      method: 'POST',
      url: '/api/v1/issue-types',
      headers: { 'x-organization-id': orgA.id },
      payload: { labelHi: 'चिप ९', labelEn: 'Chip 9', sortOrder: 9, isActive: true },
    });
    assert.strictEqual(chip9Res.statusCode, 400);
    const chip9Data = JSON.parse(chip9Res.payload);
    assert.match(chip9Data.error, /Maximum 8 active issue chips allowed/);
  } finally {
    // Clean up test organizations (cascade deletes related chips)
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
  }
});
