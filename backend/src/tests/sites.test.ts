import { test } from 'node:test';
import * as assert from 'node:assert';
import { buildServer } from '../server.js';
import { getDb } from '../db/index.js';
import { organizations, users, sites } from '../db/schema.js';
import { eq } from 'drizzle-orm';

test('Phase 2 Sites and Assignments: Work Places & Permissions Lifecycle', async () => {
  const db = getDb();
  if (!db) {
    console.log('Skipping live DB sites test (DATABASE_URL not configured)');
    return;
  }

  const server = await buildServer();

  let ownerAToken = '';
  let ownerBToken = '';
  let orgAId = '';
  let orgBId = '';
  let supervisorAId = '';
  let supervisorAToken = '';
  let site1Id = '';
  let site2Id = '';

  try {
    // 1. Signup Owner A
    const signupA = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/owner/signup',
      payload: {
        companyName: 'Sunrise Enterprises',
        name: 'Sunil Owner',
        email: `sunil_${Date.now()}@test.com`,
        phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        password: 'Password123!',
      },
    });
    const dataA = JSON.parse(signupA.payload);
    ownerAToken = dataA.tokens.accessToken;
    orgAId = dataA.organization.id;

    // 2. Signup Owner B
    const signupB = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/owner/signup',
      payload: {
        companyName: 'Moonlight Logistics',
        name: 'Manish Owner',
        email: `manish_${Date.now()}@test.com`,
        phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        password: 'Password123!',
      },
    });
    const dataB = JSON.parse(signupB.payload);
    ownerBToken = dataB.tokens.accessToken;
    orgBId = dataB.organization.id;

    // 3. Owner A creates Supervisor A
    const supPhone = `91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const createSup = await server.inject({
      method: 'POST',
      url: '/api/v1/supervisors',
      headers: { authorization: `Bearer ${ownerAToken}` },
      payload: {
        name: 'Mohan Mistri',
        phone: supPhone,
        pin: '1122',
        language: 'hi',
      },
    });
    const supData = JSON.parse(createSup.payload);
    supervisorAId = supData.supervisor.id;

    // Supervisor A logs in to obtain token
    const supLogin = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/supervisor/login',
      payload: { phone: supPhone, pin: '1122' },
    });
    supervisorAToken = JSON.parse(supLogin.payload).tokens.accessToken;

    // 4. Owner A creates two Work Places (Site 1 & Site 2)
    const site1Res = await server.inject({
      method: 'POST',
      url: '/api/v1/sites',
      headers: { authorization: `Bearer ${ownerAToken}` },
      payload: {
        name: 'Warehouse North',
        locationText: 'Sector 18, Industrial Area',
        latitude: 28.5355,
        longitude: 77.3910,
      },
    });
    assert.strictEqual(site1Res.statusCode, 201);
    site1Id = JSON.parse(site1Res.payload).site.id;

    const site2Res = await server.inject({
      method: 'POST',
      url: '/api/v1/sites',
      headers: { authorization: `Bearer ${ownerAToken}` },
      payload: {
        name: 'Depot South',
        locationText: 'Okhla Phase 3',
      },
    });
    assert.strictEqual(site2Res.statusCode, 201);
    site2Id = JSON.parse(site2Res.payload).site.id;

    // 5. Supervisor A checks assigned work places BEFORE assignment
    const supSitesBefore = await server.inject({
      method: 'GET',
      url: '/api/v1/sites',
      headers: { authorization: `Bearer ${supervisorAToken}` },
    });
    assert.strictEqual(supSitesBefore.statusCode, 200);
    // Should see 0 sites because none are assigned yet
    assert.strictEqual(JSON.parse(supSitesBefore.payload).sites.length, 0);

    // 6. Owner A assigns Supervisor A to Site 1 ONLY
    const assignRes = await server.inject({
      method: 'POST',
      url: `/api/v1/sites/${site1Id}/assign`,
      headers: { authorization: `Bearer ${ownerAToken}` },
      payload: { supervisorIds: [supervisorAId] },
    });
    assert.strictEqual(assignRes.statusCode, 200);

    // 7. Supervisor A checks assigned work places AFTER assignment
    const supSitesAfter = await server.inject({
      method: 'GET',
      url: '/api/v1/sites',
      headers: { authorization: `Bearer ${supervisorAToken}` },
    });
    assert.strictEqual(supSitesAfter.statusCode, 200);
    const assignedList = JSON.parse(supSitesAfter.payload).sites;
    assert.strictEqual(assignedList.length, 1);
    assert.strictEqual(assignedList[0].id, site1Id);
    assert.strictEqual(assignedList[0].name, 'Warehouse North');

    // Supervisor A cannot fetch unassigned Site 2
    const supGetSite2 = await server.inject({
      method: 'GET',
      url: `/api/v1/sites/${site2Id}`,
      headers: { authorization: `Bearer ${supervisorAToken}` },
    });
    assert.strictEqual(supGetSite2.statusCode, 403);

    // 8. Multi-Tenant Guard: Owner B cannot see, modify, or assign to Site 1
    const ownerBSites = await server.inject({
      method: 'GET',
      url: '/api/v1/sites',
      headers: { authorization: `Bearer ${ownerBToken}` },
    });
    assert.strictEqual(ownerBSites.statusCode, 200);
    const ownerBSiteList = JSON.parse(ownerBSites.payload).sites;
    assert.ok(!ownerBSiteList.some((s: any) => s.id === site1Id));

    const ownerBUpdateSite1 = await server.inject({
      method: 'PATCH',
      url: `/api/v1/sites/${site1Id}`,
      headers: { authorization: `Bearer ${ownerBToken}` },
      payload: { name: 'Hacked by Owner B' },
    });
    assert.strictEqual(ownerBUpdateSite1.statusCode, 404);

    // 9. Owner A updates and archives Site 2
    const archiveSite2 = await server.inject({
      method: 'PATCH',
      url: `/api/v1/sites/${site2Id}`,
      headers: { authorization: `Bearer ${ownerAToken}` },
      payload: { isArchived: true },
    });
    assert.strictEqual(archiveSite2.statusCode, 200);
    assert.strictEqual(JSON.parse(archiveSite2.payload).site.isArchived, true);

    // 10. Owner A unassigns Supervisor A from Site 1
    const unassignRes = await server.inject({
      method: 'DELETE',
      url: `/api/v1/sites/${site1Id}/assign/${supervisorAId}`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(unassignRes.statusCode, 200);
  } finally {
    if (orgAId) await db.delete(organizations).where(eq(organizations.id, orgAId));
    if (orgBId) await db.delete(organizations).where(eq(organizations.id, orgBId));
  }
});
