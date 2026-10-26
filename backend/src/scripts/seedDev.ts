import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import { getDb, testDbConnection } from '../db/index.js';
import {
  organizations,
  users,
  sites,
  siteAssignments,
  dailyRecords,
  recordIssues,
  media,
} from '../db/schema.js';
import { hashPassword, hashPin } from '../services/auth.service.js';
import { seedDefaultIssueTypes, getIssueTypesForOrg } from '../services/issueTypes.service.js';

dotenv.config();

async function runDevSeed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ FATAL: seedDev script is strictly forbidden from running in production environment!');
    process.exit(1);
  }

  console.log('🌱 Starting FieldLog Development Seeder...\n');

  const health = await testDbConnection(2, 1000);
  if (!health.connected) {
    console.error(`❌ Could not connect to database: ${health.error}`);
    console.error('Please verify TURSO_DATABASE_URL in backend/.env before seeding.');
    process.exit(1);
  }

  const db = getDb();
  if (!db) {
    console.error('❌ Database instance not initialized');
    process.exit(1);
  }

  // 1. Create or clean test organization
  const testEmail = 'owner@fieldlog.dev';
  const existingOwner = await db.select().from(users).where(eq(users.email, testEmail));
  if (existingOwner.length > 0) {
    console.log(`🧹 Removing previous dev organization for ${testEmail}...`);
    await db.delete(organizations).where(eq(organizations.id, existingOwner[0].organizationId));
  }

  console.log('🏢 Creating Dev Organization: "Apex Infra & Logistics"...');
  const [org] = await db
    .insert(organizations)
    .values({ name: 'Apex Infra & Logistics' })
    .returning();

  // 2. Create Owner Account
  console.log('👤 Creating Dev Owner: "Vikram Malhotra" (owner@fieldlog.dev / Password123!)...');
  const ownerPasswordHash = await hashPassword('Password123!');
  const [owner] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      role: 'owner',
      name: 'Vikram Malhotra (Owner)',
      email: testEmail,
      phone: '9876543210',
      passwordHash: ownerPasswordHash,
      language: 'hi',
      isActive: true,
    })
    .returning();

  // 3. Seed Default Issue Chips
  console.log('🏷️  Seeding 6 Universal Issue Chips...');
  const seededIssues = await seedDefaultIssueTypes(org.id);
  const issuesMap = new Map(seededIssues.map((i) => [i.icon || 'box', i.id]));

  // 4. Create 2 Supervisors
  console.log('👷 Creating 2 Field Supervisors:');
  console.log('   - Ramesh Kumar (Phone: 9811111111 / PIN: 1234)');
  console.log('   - Suresh Sharma (Phone: 9822222222 / PIN: 5678)');

  const pin1 = await hashPin('1234');
  const pin2 = await hashPin('5678');

  const [sup1] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      role: 'supervisor',
      name: 'Ramesh Kumar (Mistri)',
      phone: '9811111111',
      pinHash: pin1,
      language: 'hi',
      isActive: true,
    })
    .returning();

  const [sup2] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      role: 'supervisor',
      name: 'Suresh Sharma (Supervisor)',
      phone: '9822222222',
      pinHash: pin2,
      language: 'hi',
      isActive: true,
    })
    .returning();

  // 5. Create 3 Work Places (Sites)
  console.log('📍 Creating 3 Work Places:');
  const [site1] = await db
    .insert(sites)
    .values({
      organizationId: org.id,
      name: 'South Depot & Warehouse',
      locationText: 'Sector 62, Industrial Area, Noida',
      latitude: 28.628,
      longitude: 77.378,
    })
    .returning();

  const [site2] = await db
    .insert(sites)
    .values({
      organizationId: org.id,
      name: 'Highway Retail Store #4',
      locationText: 'NH-48, Sector 14, Gurgaon',
      latitude: 28.472,
      longitude: 77.045,
    })
    .returning();

  const [site3] = await db
    .insert(sites)
    .values({
      organizationId: org.id,
      name: 'North Manufacturing Unit',
      locationText: 'Plot 12, Ecotech 3, Greater Noida',
      latitude: 28.535,
      longitude: 77.489,
    })
    .returning();

  console.log(`   1. ${site1.name}`);
  console.log(`   2. ${site2.name}`);
  console.log(`   3. ${site3.name}`);

  // 6. Assign Supervisors
  console.log('🔗 Assigning Supervisors to Work Places...');
  // Ramesh -> Site 1 & Site 2
  await db.insert(siteAssignments).values([
    { siteId: site1.id, userId: sup1.id },
    { siteId: site2.id, userId: sup1.id },
  ]);
  // Suresh -> Site 2 & Site 3
  await db.insert(siteAssignments).values([
    { siteId: site2.id, userId: sup2.id },
    { siteId: site3.id, userId: sup2.id },
  ]);

  // 7. Seed 7 Days of Realistic Daily Records
  console.log('📅 Generating 7-day realistic record history...');

  const getPastDateStr = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  // Status patterns for the past 7 days (day 0 = today, day 6 = 6 days ago)
  const site1Pattern: ('full' | 'half' | 'stopped')[] = ['full', 'full', 'half', 'full', 'stopped', 'full', 'full'];
  const site2Pattern: ('full' | 'half' | 'stopped')[] = ['half', 'full', 'full', 'stopped', 'half', 'full', 'full'];
  // Site 3: today is pending (no record for day 0), shows grey in dashboard
  const site3Pattern: ('full' | 'half' | 'stopped' | null)[] = [null, 'full', 'full', 'stopped', 'half', 'full', 'full'];

  const patterns = [
    { site: site1, sup: sup1, pattern: site1Pattern },
    { site: site2, sup: sup1, pattern: site2Pattern },
    { site: site3, sup: sup2, pattern: site3Pattern },
  ];

  for (const item of patterns) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const status = item.pattern[dayOffset];
      if (!status) continue; // Pending / no record

      const recordDate = getPastDateStr(dayOffset);
      const capturedDate = new Date();
      capturedDate.setDate(capturedDate.getDate() - dayOffset);
      capturedDate.setHours(17, 30, 0, 0); // 5:30 PM

      const [record] = await db
        .insert(dailyRecords)
        .values({
          clientId: randomUUID(),
          organizationId: org.id,
          siteId: item.site.id,
          submittedBy: item.sup.id,
          recordDate,
          status,
          capturedAt: capturedDate.toISOString(),
          receivedAt: capturedDate.toISOString(),
          missingPhoto: false,
          missingVoice: dayOffset > 2,
        })
        .returning();

      // Attach issue chips if status is stopped or half
      if (status === 'stopped') {
        const issueId = seededIssues[dayOffset % seededIssues.length]?.id;
        if (issueId) {
          await db.insert(recordIssues).values({ recordId: record.id, issueTypeId: issueId });
        }
      }

      // Attach sample photo media
      await db.insert(media).values({
        recordId: record.id,
        kind: 'photo',
        storageKey: `orgs/${org.id}/sites/${item.site.id}/${recordDate}/sample_site_photo.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 420000,
        latitude: item.site.latitude,
        longitude: item.site.longitude,
        accuracyM: 8.5,
        capturedAt: capturedDate.toISOString(),
      });
    }
  }

  console.log('\n=============================================================');
  console.log('✅ Dev Database Successfully Seeded!');
  console.log('=============================================================');
  console.log('Owner Login Credentials:');
  console.log('   Email:    owner@fieldlog.dev');
  console.log('   Password: Password123!');
  console.log('\nSupervisor 1 Credentials:');
  console.log('   Phone:    9811111111');
  console.log('   PIN:      1234');
  console.log('\nSupervisor 2 Credentials:');
  console.log('   Phone:    9822222222');
  console.log('   PIN:      5678');
  console.log('=============================================================\n');

  process.exit(0);
}

runDevSeed().catch((err) => {
  console.error('Fatal seeder error:', err);
  process.exit(1);
});
