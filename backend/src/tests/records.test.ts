import { test } from 'node:test';
import * as assert from 'node:assert';
import { randomUUID } from 'crypto';
import { buildServer } from '../server.js';
import { getDb } from '../db/index.js';
import { organizations, users, sites, siteAssignments, dailyRecords, recordEdits } from '../db/schema.js';
import { eq } from 'drizzle-orm';

test('Phase 3 Daily Record: Submission, Idempotency, Same-Day Edits, and Media', async () => {
  const db = getDb();
  if (!db) {
    console.log('Skipping live DB records test (DATABASE_URL not configured)');
    return;
  }

  const server = await buildServer();

  let ownerToken = '';
  let supervisorToken = '';
  let unassignedSupervisorToken = '';
  let orgId = '';
  let siteId = '';
  let supervisorId = '';
  let unassignedSupId = '';

  try {
    // 1. Setup Organization & Owner
    const ownerRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/owner/signup',
      payload: {
        companyName: 'Metro Projects Corp',
        name: 'Metro Owner',
        email: `metro_${Date.now()}@test.com`,
        phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        password: 'Password123!',
      },
    });
    const ownerData = JSON.parse(ownerRes.payload);
    ownerToken = ownerData.tokens.accessToken;
    orgId = ownerData.organization.id;

    // 2. Setup Assigned Supervisor
    const supPhone = `91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const supRes = await server.inject({
      method: 'POST',
      url: '/api/v1/supervisors',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Ram Mistri', phone: supPhone, pin: '3344', language: 'hi' },
    });
    supervisorId = JSON.parse(supRes.payload).supervisor.id;

    const supLogin = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/supervisor/login',
      payload: { phone: supPhone, pin: '3344' },
    });
    supervisorToken = JSON.parse(supLogin.payload).tokens.accessToken;

    // 3. Setup Unassigned Supervisor
    const unassignedPhone = `91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const unassignedRes = await server.inject({
      method: 'POST',
      url: '/api/v1/supervisors',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Shyam Mistri', phone: unassignedPhone, pin: '5566', language: 'hi' },
    });
    unassignedSupId = JSON.parse(unassignedRes.payload).supervisor.id;

    const unassignedLogin = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/supervisor/login',
      payload: { phone: unassignedPhone, pin: '5566' },
    });
    unassignedSupervisorToken = JSON.parse(unassignedLogin.payload).tokens.accessToken;

    // 4. Owner creates Work Place & Assigns Supervisor
    const siteRes = await server.inject({
      method: 'POST',
      url: '/api/v1/sites',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Metro Depot Tower A', locationText: 'Sector 55' },
    });
    siteId = JSON.parse(siteRes.payload).site.id;

    await server.inject({
      method: 'POST',
      url: `/api/v1/sites/${siteId}/assign`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { supervisorIds: [supervisorId] },
    });

    // 5. Presigned Upload URL generation
    const presignRes = await server.inject({
      method: 'POST',
      url: '/api/v1/uploads/presign',
      headers: { authorization: `Bearer ${supervisorToken}` },
      payload: { siteId, kind: 'photo', mimeType: 'image/jpeg' },
    });
    assert.strictEqual(presignRes.statusCode, 200);
    const presignData = JSON.parse(presignRes.payload);
    assert.ok(presignData.uploadUrl);
    assert.ok(presignData.storageKey);

    // Unassigned supervisor cannot request presigned URL for this site
    const unassignedPresign = await server.inject({
      method: 'POST',
      url: '/api/v1/uploads/presign',
      headers: { authorization: `Bearer ${unassignedSupervisorToken}` },
      payload: { siteId, kind: 'photo', mimeType: 'image/jpeg' },
    });
    assert.strictEqual(unassignedPresign.statusCode, 403);

    // 6. Submit Daily Record (First Time)
    const clientUuid1 = randomUUID();
    const todayDate = new Date().toISOString().split('T')[0];

    const submitRes1 = await server.inject({
      method: 'POST',
      url: '/api/v1/records',
      headers: { authorization: `Bearer ${supervisorToken}` },
      payload: {
        clientId: clientUuid1,
        siteId,
        recordDate: todayDate,
        status: 'full',
        capturedAt: new Date().toISOString(),
        missingPhoto: false,
        missingVoice: true,
        photos: [
          {
            storageKey: presignData.storageKey,
            mimeType: 'image/jpeg',
            sizeBytes: 450000,
            latitude: 28.5355,
            longitude: 77.391,
            accuracyM: 12.5,
            capturedAt: new Date().toISOString(),
          },
        ],
      },
    });
    assert.strictEqual(submitRes1.statusCode, 201);
    const submit1Data = JSON.parse(submitRes1.payload);
    assert.strictEqual(submit1Data.isUpdate, false);
    const recordId = submit1Data.record.id;

    // 7. Idempotency Check: Resending exact same clientId must return existing record
    const idempotentRes = await server.inject({
      method: 'POST',
      url: '/api/v1/records',
      headers: { authorization: `Bearer ${supervisorToken}` },
      payload: {
        clientId: clientUuid1, // Identical client ID
        siteId,
        recordDate: todayDate,
        status: 'full',
        capturedAt: new Date().toISOString(),
      },
    });
    assert.strictEqual(idempotentRes.statusCode, 200);
    const idempotentData = JSON.parse(idempotentRes.payload);
    assert.strictEqual(idempotentData.idempotent, true);
    assert.strictEqual(idempotentData.record.id, recordId);

    // 8. One Record Per Site Per Day: Resubmission with new clientId updates record and logs edit
    const clientUuid2 = randomUUID();
    const submitRes2 = await server.inject({
      method: 'POST',
      url: '/api/v1/records',
      headers: { authorization: `Bearer ${supervisorToken}` },
      payload: {
        clientId: clientUuid2,
        siteId,
        recordDate: todayDate,
        status: 'half', // Status changed from 'full' to 'half'
        capturedAt: new Date().toISOString(),
      },
    });
    assert.strictEqual(submitRes2.statusCode, 200);
    const submit2Data = JSON.parse(submitRes2.payload);
    assert.strictEqual(submit2Data.isUpdate, true);
    assert.strictEqual(submit2Data.record.status, 'half');

    // Verify record_edits audit log
    const editRows = await db
      .select()
      .from(recordEdits)
      .where(eq(recordEdits.recordId, recordId));
    assert.strictEqual(editRows.length, 1);
    assert.strictEqual((editRows[0].changeJson as any).status.from, 'full');
    assert.strictEqual((editRows[0].changeJson as any).status.to, 'half');

    // 9. Supervisor checks Today's records
    const todayStatusRes = await server.inject({
      method: 'GET',
      url: '/api/v1/records/today',
      headers: { authorization: `Bearer ${supervisorToken}` },
    });
    assert.strictEqual(todayStatusRes.statusCode, 200);
    const todayStatusData = JSON.parse(todayStatusRes.payload);
    assert.strictEqual(todayStatusData.sites[0].hasSubmitted, true);
    assert.strictEqual(todayStatusData.sites[0].record.status, 'half');

    // 10. Fetch full record details
    const detailRes = await server.inject({
      method: 'GET',
      url: `/api/v1/records/${recordId}`,
      headers: { authorization: `Bearer ${supervisorToken}` },
    });
    assert.strictEqual(detailRes.statusCode, 200);
    const detailData = JSON.parse(detailRes.payload);
    assert.strictEqual(detailData.media.length, 1);
    assert.strictEqual(detailData.media[0].storageKey, presignData.storageKey);

    // 11. Phase 4: Voice Note Presign and Audio Submission
    const audioPresignRes = await server.inject({
      method: 'POST',
      url: '/api/v1/uploads/presign',
      headers: { authorization: `Bearer ${supervisorToken}` },
      payload: { siteId, kind: 'audio', mimeType: 'audio/webm' },
    });
    assert.strictEqual(audioPresignRes.statusCode, 200);
    const audioPresignData = JSON.parse(audioPresignRes.payload);
    assert.ok(audioPresignData.uploadUrl);
    assert.ok(audioPresignData.storageKey);

    const clientUuid3 = randomUUID();
    const submitAudioRes = await server.inject({
      method: 'POST',
      url: '/api/v1/records',
      headers: { authorization: `Bearer ${supervisorToken}` },
      payload: {
        clientId: clientUuid3,
        siteId,
        recordDate: todayDate,
        status: 'full',
        capturedAt: new Date().toISOString(),
        audio: {
          storageKey: audioPresignData.storageKey,
          mimeType: 'audio/webm',
          sizeBytes: 125000,
          durationSeconds: 28,
        },
      },
    });
    assert.strictEqual(submitAudioRes.statusCode, 200);
    const submitAudioData = JSON.parse(submitAudioRes.payload);
    assert.strictEqual(submitAudioData.record.missingVoice, false);

    const detailWithAudioRes = await server.inject({
      method: 'GET',
      url: `/api/v1/records/${recordId}`,
      headers: { authorization: `Bearer ${supervisorToken}` },
    });
    const detailWithAudio = JSON.parse(detailWithAudioRes.payload);
    const audioMedia = detailWithAudio.media.find((m: any) => m.kind === 'audio');
    assert.ok(audioMedia, 'Audio media record must be present');
    assert.strictEqual(audioMedia.storageKey, audioPresignData.storageKey);
    assert.strictEqual(audioMedia.durationSeconds, 28);
  } finally {
    if (orgId) await db.delete(organizations).where(eq(organizations.id, orgId));
  }
});
