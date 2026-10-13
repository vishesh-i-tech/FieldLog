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
  issueTypeIds: z.array(z.string().uuid()).default([]),
  photos: z.array(photoSubmissionSchema).max(6, 'Maximum 6 photos per record').default([]),
  audio: audioSubmissionSchema.optional(),
});

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

    // If supervisor, verify assignment
    if (user.role === 'supervisor') {
      const [assignment] = await db
        .select()
        .from(siteAssignments)
        .where(and(eq(siteAssignments.siteId, siteId), eq(siteAssignments.userId, user.userId)));

      if (!assignment) {
        return reply.status(403).send({ error: 'You are not assigned to this work place' });
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
          flags: { ...(existingDayRecord.flags as object || {}), ...flags },
          missingPhoto: photos.length === 0,
          missingVoice,
          updatedAt: now,
        })
        .where(eq(dailyRecords.id, existingDayRecord.id))
        .returning();

      // 3. Sync issues (clear and re-link current active issues)
      await db.delete(recordIssues).where(eq(recordIssues.recordId, existingDayRecord.id));
      if (issueTypeIds.length > 0) {
        const issueRows = issueTypeIds.map((issueTypeId) => ({
          recordId: existingDayRecord.id,
          issueTypeId,
        }));
        await db.insert(recordIssues).values(issueRows);
      }

      // 4. Attach any newly submitted photos
      if (photos.length > 0) {
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

      // 5. Attach audio if provided
      if (audio) {
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
    if (issueTypeIds.length > 0) {
      const issueRows = issueTypeIds.map((issueTypeId) => ({
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
    if (siteIds.length > 0) {
      todayRecords = await db
        .select()
        .from(dailyRecords)
        .where(
          and(
            inArray(dailyRecords.siteId, siteIds),
            eq(dailyRecords.recordDate, todayStr)
          )
        );
    }

    const recordsBySiteId = new Map(todayRecords.map((r) => [r.siteId, r]));

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
      .select()
      .from(dailyRecords)
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

    return reply.status(200).send({
      record,
      issues: issuesList,
      media: mediaList,
    });
  });
};
