import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  date,
  timestamp,
  numeric,
  integer,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. ORGANIZATIONS
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. USERS
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 32 }).$type<'owner' | 'supervisor'>().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 32 }).notNull().unique(),
  email: varchar('email', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  pinHash: varchar('pin_hash', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  language: varchar('language', { length: 16 }).default('hi').notNull(),
  pushToken: varchar('push_token', { length: 255 }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('users_org_idx').on(table.organizationId),
  index('users_phone_idx').on(table.phone),
]);

// 3. SITES
export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  locationText: text('location_text').notNull(),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('sites_org_idx').on(table.organizationId),
]);

// 4. SITE ASSIGNMENTS
export const siteAssignments = pgTable('site_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('unique_site_user').on(table.siteId, table.userId),
  index('site_assignments_user_idx').on(table.userId),
]);

// 5. DAILY RECORDS
export const dailyRecords = pgTable('daily_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().unique(), // Client-generated UUID for idempotency
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  submittedBy: uuid('submitted_by')
    .notNull()
    .references(() => users.id),
  recordDate: date('record_date').notNull(), // YYYY-MM-DD
  status: varchar('status', { length: 32 }).$type<'full' | 'half' | 'stopped'>().notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  flags: jsonb('flags').default({}).notNull(),
  missingPhoto: boolean('missing_photo').default(false).notNull(),
  missingVoice: boolean('missing_voice').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('unique_site_record_date').on(table.siteId, table.recordDate),
  index('records_org_date_idx').on(table.organizationId, table.recordDate),
  index('records_site_idx').on(table.siteId),
]);

// 6. RECORD ISSUES
export const recordIssues = pgTable('record_issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordId: uuid('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  issueType: varchar('issue_type', { length: 64 })
    .$type<'material_not_arrived' | 'less_manpower' | 'rain' | 'machine_broken' | 'need_money' | 'other'>()
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('record_issues_record_idx').on(table.recordId),
]);

// 7. MEDIA (Photos & Audio)
export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordId: uuid('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 32 }).$type<'photo' | 'audio'>().notNull(),
  storageKey: varchar('storage_key', { length: 512 }).notNull(),
  mimeType: varchar('mime_type', { length: 64 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  durationSeconds: integer('duration_seconds'),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  accuracyM: numeric('accuracy_m', { precision: 8, scale: 2 }),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
  flags: jsonb('flags').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('media_record_idx').on(table.recordId),
]);

// 8. TRANSCRIPTS
export const transcripts = pgTable('transcripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordId: uuid('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  audioMediaId: uuid('audio_media_id')
    .notNull()
    .references(() => media.id, { onDelete: 'cascade' }),
  language: varchar('language', { length: 16 }).default('hi').notNull(),
  rawText: text('raw_text').notNull(),
  status: varchar('status', { length: 32 }).$type<'pending' | 'done' | 'failed'>().notNull(),
  provider: varchar('provider', { length: 64 }).notNull(),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('transcripts_record_idx').on(table.recordId),
]);

// 9. SUMMARIES
export const summaries = pgTable('summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordId: uuid('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  summaryText: text('summary_text').notNull(),
  materialMentions: jsonb('material_mentions').default([]).notNull(),
  modelInfo: varchar('model_info', { length: 128 }).notNull(),
  status: varchar('status', { length: 32 }).$type<'pending' | 'done' | 'failed'>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('summaries_record_idx').on(table.recordId),
]);

// 10. RECORD EDITS (Audit trail for same-day updates)
export const recordEdits = pgTable('record_edits', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordId: uuid('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  editedBy: uuid('edited_by')
    .notNull()
    .references(() => users.id),
  changeJson: jsonb('change_json').notNull(),
  editedAt: timestamp('edited_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('record_edits_record_idx').on(table.recordId),
]);

// 11. RECORD ACKNOWLEDGEMENTS (Owner "Seen" tick)
export const recordAcknowledgements = pgTable('record_acknowledgements', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordId: uuid('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  seenAt: timestamp('seen_at', { withTimezone: true }).defaultNow().notNull(),
  replyMediaId: uuid('reply_media_id').references(() => media.id),
}, (table) => [
  index('acknowledgements_record_idx').on(table.recordId),
]);

// 12. NOTIFICATION LOG
export const notificationLog = pgTable('notification_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 64 }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
  status: varchar('status', { length: 32 }).$type<'sent' | 'failed'>().notNull(),
}, (table) => [
  index('notifications_user_idx').on(table.userId),
]);

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  sites: many(sites),
  dailyRecords: many(dailyRecords),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [sites.organizationId],
    references: [organizations.id],
  }),
  assignments: many(siteAssignments),
  records: many(dailyRecords),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  assignments: many(siteAssignments),
  submittedRecords: many(dailyRecords),
}));

export const dailyRecordsRelations = relations(dailyRecords, ({ one, many }) => ({
  site: one(sites, {
    fields: [dailyRecords.siteId],
    references: [sites.id],
  }),
  submitter: one(users, {
    fields: [dailyRecords.submittedBy],
    references: [users.id],
  }),
  issues: many(recordIssues),
  mediaList: many(media),
  transcript: one(transcripts),
  summary: one(summaries),
  edits: many(recordEdits),
  acknowledgements: many(recordAcknowledgements),
}));
