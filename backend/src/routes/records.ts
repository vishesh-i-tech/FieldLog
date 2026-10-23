import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  dailyRecords,
  recordIssues,
  media,
  recordEdits,
  sites,
  siteAssignments,
  issueTypes,
  users,
} from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';

const photoSubmissionSchema = z.object({
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracyM: z.number().optional(),
  capturedAt: z.string(),
  flags: z.record(z.any()).default({}),
});

const audioSubmissionSchema = z.object({
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  durationSeconds: z.number().int().nonnegative().optional(),
  capturedAt: z.string().optional(),
});

const submitRecordSchema = z.object({
  clientId: z.string().uuid('Valid client UUID required for idempotent sync'),
  siteId: z.string().uuid(),
  recordDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'recordDate must be YYYY-MM-DD'),
  status: z.enum(['full', 'half', 'stopped']),
  capturedAt: z.string(),
  missingPhoto: z.boolean().default(false),
  missingVoice: z.boolean().default(false),
  flags: z.record(z.any()).default({}),
  issueTypeIds: z.array(z.string()).default([]),
  photos: z.array(photoSubmissionSchema).max(6, 'Maximum 6 photos per record').default([]),
  audio: audioSubmissionSchema.optional(),
});

async function resolveIssueTypeIds(db: any, orgId: string, inputIds: string[]): Promise<string[]> {
  if (!inputIds || inputIds.length === 0) return [];
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const orgIssues = await db
    .select()
    .from(issueTypes)
    .where(eq(issueTypes.organizationId, orgId));

  const resolved = new Set<string>();
  for (const rawId of inputIds) {
    if (uuidRegex.test(rawId)) {
      const match = orgIssues.find((oi: any) => oi.id === rawId);
      if (match) resolved.add(match.id);
    } else {
      const num = parseInt(rawId, 10);
      if (!isNaN(num) && num >= 1 && num <= orgIssues.length) {
        resolved.add(orgIssues[num - 1].id);
      } else {
        const match = orgIssues.find((oi: any) =>
          oi.labelEn.toLowerCase().includes(rawId.toLowerCase()) ||
          oi.labelHi.includes(rawId)
        );
        if (match) {
          resolved.add(match.id);
        } else if (typeof rawId === 'string' && rawId.trim().length > 0) {
          // Dynamic custom issue inserted by field officer
          const trimmed = rawId.trim();
          const [created] = await db
            .insert(issueTypes)
            .values({
              organizationId: orgId,
              labelHi: trimmed,
              labelEn: trimmed,
              icon: '⚠️',
              sortOrder: orgIssues.length + 1,
              isActive: true,
              isDefault: false,
            })
            .returning();
          if (created) {
            resolved.add(created.id);
            orgIssues.push(created);
          }
        }
      }
    }
  }
  return Array.from(resolved);
}

export const recordRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

  // 1. Submit or Update Daily Record (Online)
  fastify.post('/api/v1/records', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const user = request.user!;
    const parsed = submitRecordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message || 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const {
      clientId,
      siteId,
      recordDate,
      status,
      capturedAt,
      missingPhoto,
      flags,
      issueTypeIds,
      photos,
      audio,
    } = parsed.data;

    const hasVoice = !!audio;
    const missingVoice = hasVoice ? false : (parsed.data.missingVoice ?? true);

    // Verify site belongs to user's organization
    const [site] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.organizationId, user.organizationId)));

    if (!site) {
      return reply.status(404).send({ error: 'Work place not found in your organization' });
    }

    // If supervisor, verify or auto-link assignment within their organization
    if (user.role === 'supervisor') {
      const [assignment] = await db
        .select()
        .from(siteAssignments)
        .where(and(eq(siteAssignments.siteId, siteId), eq(siteAssignments.userId, user.userId)));

      if (!assignment) {
        // Auto-assign supervisor to this site so they are never locked out of submission
        try {
          await db.insert(siteAssignments).values({
            siteId,
            userId: user.userId,
          });
        } catch {
          // Ignore duplicate assignment error
        }
      }
    }

    // A. IDEMPOTENCY CHECK: If clientId already processed, return existing record
    const [existingClientRecord] = await db
      .select()
      .from(dailyRecords)
      .where(eq(dailyRecords.clientId, clientId));

    if (existingClientRecord) {
      return reply.status(200).send({
        message: 'Record already received (idempotent)',
        record: existingClientRecord,
        isUpdate: false,
        idempotent: true,
      });
    }

    // B. ONE RECORD PER SITE PER DAY RULE: Check if record exists for this site & date
    const [existingDayRecord] = await db
      .select()
      .from(dailyRecords)
      .where(and(eq(dailyRecords.siteId, siteId), eq(dailyRecords.recordDate, recordDate)));

    const now = new Date();
    const capturedAtDate = new Date(capturedAt);

    if (existingDayRecord) {
      // SAME-DAY UPDATE: compute audit diff and update record
      const changeDiff: Record<string, any> = {};
      if (existingDayRecord.status !== status) {
        changeDiff.status = { from: existingDayRecord.status, to: status };
      }
      changeDiff.previousClientId = existingDayRecord.clientId;
      changeDiff.newClientId = clientId;

      // 1. Record edit audit entry
      await db.insert(recordEdits).values({
        recordId: existingDayRecord.id,
        editedBy: user.userId,
        changeJson: changeDiff,
      });

      // 2. Update existing daily record
      const [updatedRecord] = await db
        .update(dailyRecords)
        .set({
          clientId, // Update client ID to new submission ID
          status,
          capturedAt: capturedAtDate,
          receivedAt: now,
          submittedBy: user.userId,
          flags: { ...(existingDayRecord.flags as object || {}), ...flags },
          missingPhoto: photos.length === 0,
          missingVoice,
          updatedAt: now,
        })
        .where(eq(dailyRecords.id, existingDayRecord.id))
        .returning();

      // 3. Sync issues (clear and re-link current active issues)
      await db.delete(recordIssues).where(eq(recordIssues.recordId, existingDayRecord.id));
      const resolvedIssueIds = await resolveIssueTypeIds(db, user.organizationId, issueTypeIds);
      if (resolvedIssueIds.length > 0) {
        const issueRows = resolvedIssueIds.map((issueTypeId) => ({
          recordId: existingDayRecord.id,
          issueTypeId,
        }));
        await db.insert(recordIssues).values(issueRows);
      }

      // 4. Attach any newly submitted photos (replace previous on new upload)
      if (photos.length > 0) {
        await db.delete(media).where(and(eq(media.recordId, existingDayRecord.id), eq(media.kind, 'photo')));
        const photoRows = photos.map((p) => ({
          recordId: existingDayRecord.id,
          kind: 'photo' as const,
          storageKey: p.storageKey,
          mimeType: p.mimeType,
          sizeBytes: p.sizeBytes,
          latitude: p.latitude ? p.latitude.toString() : null,
          longitude: p.longitude ? p.longitude.toString() : null,
          accuracyM: p.accuracyM ? p.accuracyM.toString() : null,
          capturedAt: new Date(p.capturedAt),
          flags: p.flags,
        }));
        await db.insert(media).values(photoRows);
      }

      // 5. Attach audio if provided (replaces previous audio)
      if (audio) {
        await db.delete(media).where(and(eq(media.recordId, existingDayRecord.id), eq(media.kind, 'audio')));
        await db.insert(media).values({
          recordId: existingDayRecord.id,
          kind: 'audio',
          storageKey: audio.storageKey,
          mimeType: audio.mimeType,
          sizeBytes: audio.sizeBytes,
          durationSeconds: audio.durationSeconds || null,
          capturedAt: audio.capturedAt ? new Date(audio.capturedAt) : capturedAtDate,
        });
      }

      return reply.status(200).send({
        message: "Today's record updated successfully.",
        record: updatedRecord,
        isUpdate: true,
      });
    }

    // C. NEW RECORD SUBMISSION
    const [newRecord] = await db
      .insert(dailyRecords)
      .values({
        clientId,
        organizationId: user.organizationId,
        siteId,
        submittedBy: user.userId,
        recordDate,
        status,
        capturedAt: capturedAtDate,
        receivedAt: now,
        flags,
        missingPhoto: photos.length === 0,
        missingVoice,
      })
      .returning();

    // Insert issue chips
    const resolvedIssueIds = await resolveIssueTypeIds(db, user.organizationId, issueTypeIds);
    if (resolvedIssueIds.length > 0) {
      const issueRows = resolvedIssueIds.map((issueTypeId) => ({
        recordId: newRecord.id,
        issueTypeId,
      }));
      await db.insert(recordIssues).values(issueRows);
    }

    // Insert photos
    if (photos.length > 0) {
      const photoRows = photos.map((p) => ({
        recordId: newRecord.id,
        kind: 'photo' as const,
        storageKey: p.storageKey,
        mimeType: p.mimeType,
        sizeBytes: p.sizeBytes,
        latitude: p.latitude ? p.latitude.toString() : null,
        longitude: p.longitude ? p.longitude.toString() : null,
        accuracyM: p.accuracyM ? p.accuracyM.toString() : null,
        capturedAt: new Date(p.capturedAt),
        flags: p.flags,
      }));
      await db.insert(media).values(photoRows);
    }

    // Insert audio if provided
    if (audio) {
      await db.insert(media).values({
        recordId: newRecord.id,
        kind: 'audio',
        storageKey: audio.storageKey,
        mimeType: audio.mimeType,
        sizeBytes: audio.sizeBytes,
        durationSeconds: audio.durationSeconds || null,
        capturedAt: audio.capturedAt ? new Date(audio.capturedAt) : capturedAtDate,
      });
    }

    return reply.status(201).send({
      message: 'Daily record submitted successfully.',
      record: newRecord,
      isUpdate: false,
    });
  });

  // 2. Get Today's Records for Supervisor's Assigned Sites
  fastify.get('/api/v1/records/today', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const user = request.user!;
    const todayStr = new Date().toISOString().split('T')[0];

    // Find sites assigned to supervisor (or all sites if owner)
    let targetSites: { id: string; name: string }[] = [];
    if (user.role === 'owner') {
      targetSites = await db
        .select({ id: sites.id, name: sites.name })
        .from(sites)
        .where(and(eq(sites.organizationId, user.organizationId), eq(sites.isArchived, false)));
    } else {
      targetSites = await db
        .select({ id: sites.id, name: sites.name })
        .from(sites)
        .innerJoin(siteAssignments, eq(sites.id, siteAssignments.siteId))
        .where(
          and(
            eq(sites.organizationId, user.organizationId),
            eq(sites.isArchived, false),
            eq(siteAssignments.userId, user.userId)
          )
        );
    }

    const siteIds = targetSites.map((s) => s.id);
    let todayRecords: any[] = [];
    let recordIssuesMap: Record<string, any[]> = {};

    if (siteIds.length > 0) {
      todayRecords = await db
        .select({
          id: dailyRecords.id,
          siteId: dailyRecords.siteId,
          status: dailyRecords.status,
          capturedAt: dailyRecords.capturedAt,
          createdAt: dailyRecords.createdAt,
          updatedAt: dailyRecords.updatedAt,
          missingPhoto: dailyRecords.missingPhoto,
          missingVoice: dailyRecords.missingVoice,
          flags: dailyRecords.flags,
          submittedBy: dailyRecords.submittedBy,
          submitterName: users.name,
        })
        .from(dailyRecords)
        .leftJoin(users, eq(dailyRecords.submittedBy, users.id))
        .where(
          and(
            inArray(dailyRecords.siteId, siteIds),
            eq(dailyRecords.recordDate, todayStr)
          )
        );

      const recordIds = todayRecords.map((r) => r.id);
      if (recordIds.length > 0) {
        const issuesRows = await db
          .select({
            recordId: recordIssues.recordId,
            id: issueTypes.id,
            labelHi: issueTypes.labelHi,
            labelEn: issueTypes.labelEn,
            icon: issueTypes.icon,
          })
          .from(recordIssues)
          .innerJoin(issueTypes, eq(recordIssues.issueTypeId, issueTypes.id))
          .where(inArray(recordIssues.recordId, recordIds));

        for (const row of issuesRows) {
          if (!recordIssuesMap[row.recordId]) recordIssuesMap[row.recordId] = [];
          recordIssuesMap[row.recordId].push({
            id: row.id,
            labelHi: row.labelHi,
            labelEn: row.labelEn,
            icon: row.icon,
          });
        }
      }
    }

    const recordsBySiteId = new Map(
      todayRecords.map((r) => [
        r.siteId,
        {
          ...r,
          issues: recordIssuesMap[r.id] || [],
        },
      ])
    );

    const summary = targetSites.map((site) => ({
      siteId: site.id,
      siteName: site.name,
      hasSubmitted: recordsBySiteId.has(site.id),
      record: recordsBySiteId.get(site.id) || null,
    }));

    return reply.status(200).send({
      date: todayStr,
      sites: summary,
    });
  });

  // 3. Get Single Record with Full Details (Issues, Photos)
  fastify.get('/api/v1/records/:id', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const user = request.user!;
    const { id } = request.params as { id: string };

    const [record] = await db
      .select({
        id: dailyRecords.id,
        siteId: dailyRecords.siteId,
        status: dailyRecords.status,
        capturedAt: dailyRecords.capturedAt,
        receivedAt: dailyRecords.receivedAt,
        createdAt: dailyRecords.createdAt,
        updatedAt: dailyRecords.updatedAt,
        missingPhoto: dailyRecords.missingPhoto,
        missingVoice: dailyRecords.missingVoice,
        flags: dailyRecords.flags,
        submittedBy: dailyRecords.submittedBy,
        submitterName: users.name,
      })
      .from(dailyRecords)
      .leftJoin(users, eq(dailyRecords.submittedBy, users.id))
      .where(and(eq(dailyRecords.id, id), eq(dailyRecords.organizationId, user.organizationId)));

    if (!record) {
      return reply.status(404).send({ error: 'Daily record not found' });
    }

    // Fetch associated issues
    const issuesList = await db
      .select({
        id: issueTypes.id,
        labelHi: issueTypes.labelHi,
        labelEn: issueTypes.labelEn,
        icon: issueTypes.icon,
      })
      .from(recordIssues)
      .innerJoin(issueTypes, eq(recordIssues.issueTypeId, issueTypes.id))
      .where(eq(recordIssues.recordId, record.id));

    // Fetch associated media
    const mediaList = await db
      .select()
      .from(media)
      .where(eq(media.recordId, record.id));

    const mediaWithUrls = mediaList.map((m) => {
      let downloadUrl = m.storageKey;
      if (!downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://') && !downloadUrl.startsWith('data:')) {
        downloadUrl = `http://localhost:4000/api/v1/dev-storage/files/${encodeURIComponent(m.storageKey)}`;
      }
      return {
        ...m,
        url: downloadUrl,
      };
    });

    return reply.status(200).send({
      record,
      issues: issuesList,
      media: mediaWithUrls,
    });
  });

  // 4. Get All Past Daily Records for a Site (Date-Wise History)
  fastify.get('/api/v1/sites/:siteId/records', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const user = request.user!;
    const { siteId } = request.params as { siteId: string };

    // Ensure site belongs to user's organization
    const [site] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.organizationId, user.organizationId)));

    if (!site) {
      return reply.status(404).send({ error: 'Work place not found in your organization' });
    }

    // Fetch all daily records for this site ordered by recordDate DESC
    const allRecords = await db
      .select({
        id: dailyRecords.id,
        siteId: dailyRecords.siteId,
        recordDate: dailyRecords.recordDate,
        status: dailyRecords.status,
        capturedAt: dailyRecords.capturedAt,
        receivedAt: dailyRecords.receivedAt,
        createdAt: dailyRecords.createdAt,
        updatedAt: dailyRecords.updatedAt,
        missingPhoto: dailyRecords.missingPhoto,
        missingVoice: dailyRecords.missingVoice,
        flags: dailyRecords.flags,
        submittedBy: dailyRecords.submittedBy,
        submitterName: users.name,
      })
      .from(dailyRecords)
      .leftJoin(users, eq(dailyRecords.submittedBy, users.id))
      .where(eq(dailyRecords.siteId, siteId))
      .orderBy(desc(dailyRecords.recordDate));

    const recordIds = allRecords.map((r) => r.id);
    let recordIssuesMap: Record<string, any[]> = {};
    let recordMediaMap: Record<string, any[]> = {};

    if (recordIds.length > 0) {
      // 1. Issues
      const issuesRows = await db
        .select({
          recordId: recordIssues.recordId,
          id: issueTypes.id,
          labelHi: issueTypes.labelHi,
          labelEn: issueTypes.labelEn,
          icon: issueTypes.icon,
        })
        .from(recordIssues)
        .innerJoin(issueTypes, eq(recordIssues.issueTypeId, issueTypes.id))
        .where(inArray(recordIssues.recordId, recordIds));

      for (const row of issuesRows) {
        if (!recordIssuesMap[row.recordId]) recordIssuesMap[row.recordId] = [];
        recordIssuesMap[row.recordId].push({
          id: row.id,
          labelHi: row.labelHi,
          labelEn: row.labelEn,
          icon: row.icon,
        });
      }

      // 2. Media (Photos and Audio)
      const mediaRows = await db
        .select()
        .from(media)
        .where(inArray(media.recordId, recordIds));

      for (const m of mediaRows) {
        if (!recordMediaMap[m.recordId]) recordMediaMap[m.recordId] = [];
        let downloadUrl = m.storageKey;
        if (!downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://') && !downloadUrl.startsWith('data:')) {
          downloadUrl = `http://localhost:4000/api/v1/dev-storage/files/${encodeURIComponent(m.storageKey)}`;
        }
        recordMediaMap[m.recordId].push({
          ...m,
          url: downloadUrl,
        });
      }
    }

    const enriched = allRecords.map((r) => ({
      ...r,
      issues: recordIssuesMap[r.id] || [],
      media: recordMediaMap[r.id] || [],
    }));

    return reply.status(200).send({
      siteId,
      siteName: site.name,
      totalRecords: enriched.length,
      records: enriched,
    });
  });
};
