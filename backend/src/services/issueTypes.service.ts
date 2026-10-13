import { eq, and, asc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { issueTypes } from '../db/schema.js';

export const DEFAULT_ISSUE_SEEDS = [
  {
    labelHi: 'सामान / स्टॉक नहीं आया',
    labelEn: 'Material / Stock not arrived',
    icon: 'box',
    sortOrder: 1,
    isDefault: true,
  },
  {
    labelHi: 'कम लोग / स्टाफ कम',
    labelEn: 'Less manpower / staff',
    icon: 'users',
    sortOrder: 2,
    isDefault: true,
  },
  {
    labelHi: 'बारिश / मौसम खराब',
    labelEn: 'Rain / Bad weather',
    icon: 'cloud-rain',
    sortOrder: 3,
    isDefault: true,
  },
  {
    labelHi: 'मशीन / गाड़ी खराब',
    labelEn: 'Machine / Vehicle breakdown',
    icon: 'tool',
    sortOrder: 4,
    isDefault: true,
  },
  {
    labelHi: 'पैसे चाहिए',
    labelEn: 'Need funds / cash',
    icon: 'cash',
    sortOrder: 5,
    isDefault: true,
  },
  {
    labelHi: 'अन्य समस्या',
    labelEn: 'Other issue',
    icon: 'alert-circle',
    sortOrder: 6,
    isDefault: true,
  },
];

/**
 * Seeds default issue types for a newly created organization.
 */
export async function seedDefaultIssueTypes(organizationId: string) {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const rowsToInsert = DEFAULT_ISSUE_SEEDS.map((seed) => ({
    organizationId,
    labelHi: seed.labelHi,
    labelEn: seed.labelEn,
    icon: seed.icon,
    sortOrder: seed.sortOrder,
    isActive: true,
    isDefault: true,
  }));

  return db.insert(issueTypes).values(rowsToInsert).returning();
}

/**
 * Retrieves issue types for an organization with tenant isolation.
 * If activeOnly is true (for supervisors), only returns active chips, ordered by sortOrder (limit 8).
 */
export async function getIssueTypesForOrg(organizationId: string, activeOnly = false) {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const conditions = [eq(issueTypes.organizationId, organizationId)];
  if (activeOnly) {
    conditions.push(eq(issueTypes.isActive, true));
  }

  const query = db
    .select()
    .from(issueTypes)
    .where(and(...conditions))
    .orderBy(asc(issueTypes.sortOrder));

  if (activeOnly) {
    return query.limit(8);
  }

  return query;
}
