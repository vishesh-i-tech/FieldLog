import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// 1. ORGANIZATIONS
export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// 2. USERS
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  role: text('role').$type<'owner' | 'supervisor'>().notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  email: text('email'),
  passwordHash: text('password_hash'),
  pinHash: text('pin_hash'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  language: text('language').default('hi').notNull(),
  pushToken: text('push_token'),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('users_org_idx').on(table.organizationId),
  index('users_phone_idx').on(table.phone),
]);

// 3. SITES
export const sites = sqliteTable('sites', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  locationText: text('location_text').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  isArchived: integer('is_archived', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('sites_org_idx').on(table.organizationId),
]);

// 4. SITE ASSIGNMENTS
export const siteAssignments = sqliteTable('site_assignments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  uniqueIndex('unique_site_user').on(table.siteId, table.userId),
  index('site_assignments_user_idx').on(table.userId),
]);

// 5. DAILY RECORDS
export const dailyRecords = sqliteTable('daily_records', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text('client_id').notNull().unique(), // Client-generated UUID for idempotency
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  submittedBy: text('submitted_by')
    .notNull()
    .references(() => users.id),
  recordDate: text('record_date').notNull(), // YYYY-MM-DD
  status: text('status').$type<'full' | 'half' | 'stopped'>().notNull(),
  capturedAt: text('captured_at').notNull(),
  receivedAt: text('received_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  flags: text('flags', { mode: 'json' }).$type<Record<string, any>>().default({}).notNull(),
  missingPhoto: integer('missing_photo', { mode: 'boolean' }).default(false).notNull(),
  missingVoice: integer('missing_voice', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  uniqueIndex('unique_site_record_date').on(table.siteId, table.recordDate),
  index('records_org_date_idx').on(table.organizationId, table.recordDate),
  index('records_site_idx').on(table.siteId),
]);

// 6. ISSUE TYPES (Customizable per Organization, max 8 active visible)
export const issueTypes = sqliteTable('issue_types', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  labelHi: text('label_hi').notNull(),
  labelEn: text('label_en').notNull(),
  icon: text('icon'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('issue_types_org_idx').on(table.organizationId),
  index('issue_types_sort_idx').on(table.organizationId, table.sortOrder),
]);

// 7. RECORD ISSUES
export const recordIssues = sqliteTable('record_issues', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordId: text('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  issueTypeId: text('issue_type_id')
    .notNull()
    .references(() => issueTypes.id, { onDelete: 'restrict' }),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('record_issues_record_idx').on(table.recordId),
  index('record_issues_type_idx').on(table.issueTypeId),
]);

// 8. MEDIA (Photos & Audio)
export const media = sqliteTable('media', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordId: text('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'photo' | 'audio'>().notNull(),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  durationSeconds: integer('duration_seconds'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  accuracyM: real('accuracy_m'),
  capturedAt: text('captured_at').notNull(),
  flags: text('flags', { mode: 'json' }).$type<Record<string, any>>().default({}).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('media_record_idx').on(table.recordId),
]);

// 9. TRANSCRIPTS
export const transcripts = sqliteTable('transcripts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordId: text('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  audioMediaId: text('audio_media_id')
    .notNull()
    .references(() => media.id, { onDelete: 'cascade' }),
  language: text('language').default('hi').notNull(),
  rawText: text('raw_text').notNull(),
  status: text('status').$type<'pending' | 'done' | 'failed'>().notNull(),
  provider: text('provider').notNull(),
  error: text('error'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('transcripts_record_idx').on(table.recordId),
]);

// 10. SUMMARIES
export const summaries = sqliteTable('summaries', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordId: text('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  summaryText: text('summary_text').notNull(),
  materialMentions: text('material_mentions', { mode: 'json' }).$type<any[]>().default([]).notNull(),
  modelInfo: text('model_info').notNull(),
  status: text('status').$type<'pending' | 'done' | 'failed'>().notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('summaries_record_idx').on(table.recordId),
]);

// 11. RECORD EDITS (Audit trail for same-day updates)
export const recordEdits = sqliteTable('record_edits', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordId: text('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  editedBy: text('edited_by')
    .notNull()
    .references(() => users.id),
  changeJson: text('change_json', { mode: 'json' }).$type<Record<string, any>>().notNull(),
  editedAt: text('edited_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('record_edits_record_idx').on(table.recordId),
]);

// 12. RECORD ACKNOWLEDGEMENTS (Owner "Seen" tick)
export const recordAcknowledgements = sqliteTable('record_acknowledgements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordId: text('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id),
  seenAt: text('seen_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  replyMediaId: text('reply_media_id').references(() => media.id),
}, (table) => [
  index('acknowledgements_record_idx').on(table.recordId),
]);

// 13. NOTIFICATION LOG
export const notificationLog = sqliteTable('notification_log', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  sentAt: text('sent_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  status: text('status').$type<'sent' | 'failed'>().notNull(),
}, (table) => [
  index('notifications_user_idx').on(table.userId),
]);

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  sites: many(sites),
  dailyRecords: many(dailyRecords),
  issueTypes: many(issueTypes),
}));

export const issueTypesRelations = relations(issueTypes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [issueTypes.organizationId],
    references: [organizations.id],
  }),
  recordIssues: many(recordIssues),
}));

export const recordIssuesRelations = relations(recordIssues, ({ one }) => ({
  record: one(dailyRecords, {
    fields: [recordIssues.recordId],
    references: [dailyRecords.id],
  }),
  issueType: one(issueTypes, {
    fields: [recordIssues.issueTypeId],
    references: [issueTypes.id],
  }),
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
