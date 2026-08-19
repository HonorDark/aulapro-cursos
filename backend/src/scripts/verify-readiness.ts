import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { QueryResultRow } from "pg";
import { pool, query } from "../config/database";

type AppliedMigration = QueryResultRow & {
  file_name: string;
  checksum: string;
};

type Readiness = QueryResultRow & {
  token_version_ready: boolean;
  categories_status_ready: boolean;
  enrollment_access_ready: boolean;
  pending_guard_ready: boolean;
  duplicate_pending_groups: number;
  active_paid_without_approved_link: number;
  broken_demo_texts: number;
  non_bcrypt_passwords: number;
  active_super_admins: number;
  active_enrollments: number;
  pending_payments: number;
};

async function verifyReadiness() {
  const migrationsDirectory = path.resolve(__dirname, "../../database/migrations");
  const migrationFiles = (await fs.readdir(migrationsDirectory))
    .filter((file) => /^\d+.*\.sql$/i.test(file))
    .sort();
  const applied = await query<AppliedMigration>(
    "SELECT file_name,checksum FROM schema_migrations ORDER BY file_name",
  );
  const appliedByName = new Map(
    applied.rows.map((migration) => [migration.file_name, migration.checksum.trim()]),
  );
  const missingMigrations: string[] = [];
  const changedMigrations: string[] = [];

  for (const fileName of migrationFiles) {
    const contents = await fs.readFile(path.join(migrationsDirectory, fileName), "utf8");
    const checksum = crypto.createHash("sha256").update(contents).digest("hex");
    const appliedChecksum = appliedByName.get(fileName);
    if (!appliedChecksum) missingMigrations.push(fileName);
    else if (appliedChecksum !== checksum) changedMigrations.push(fileName);
  }

  const result = await query<Readiness>(`
    SELECT
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='token_version') token_version_ready,
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='is_active') categories_status_ready,
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='enrollments' AND column_name='access_status') enrollment_access_ready,
      EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='payments_one_pending_per_course_idx') pending_guard_ready,
      (SELECT COUNT(*) FROM (
        SELECT user_id,course_id FROM payments WHERE status='PENDING'
        GROUP BY user_id,course_id HAVING COUNT(*)>1
      ) duplicated)::int duplicate_pending_groups,
      (SELECT COUNT(*) FROM enrollments e
        JOIN courses c ON c.id=e.course_id
        LEFT JOIN payments p ON p.id=e.payment_id AND p.status='APPROVED'
        WHERE c.price>0 AND e.access_status='ACTIVE' AND p.id IS NULL
      )::int active_paid_without_approved_link,
      (SELECT COUNT(*) FROM (
        SELECT name AS value FROM users WHERE LOWER(email) IN ('student@aulapro.test','lucia@aulaflow.test')
        UNION ALL SELECT title FROM courses WHERE slug IN ('react-typescript','node-apis','ux-ui','liderazgo-agil','marketing-datos','postgresql')
        UNION ALL SELECT description FROM categories WHERE slug IN ('desarrollo','diseno','negocios','marketing')
      ) seeded_text WHERE value ~ '[ÃÂ]')::int broken_demo_texts,
      (SELECT COUNT(*) FROM users WHERE password_hash !~ '^\\$2[aby]\\$')::int non_bcrypt_passwords,
      (SELECT COUNT(*) FROM users WHERE role='SUPER_ADMIN' AND is_active=true)::int active_super_admins,
      (SELECT COUNT(*) FROM enrollments WHERE access_status='ACTIVE')::int active_enrollments,
      (SELECT COUNT(*) FROM payments WHERE status='PENDING')::int pending_payments
  `);
  const data = result.rows[0];
  const ready = missingMigrations.length === 0 && changedMigrations.length === 0 &&
    data.token_version_ready && data.categories_status_ready && data.enrollment_access_ready &&
    data.pending_guard_ready && data.duplicate_pending_groups === 0 &&
    data.active_paid_without_approved_link === 0 && data.broken_demo_texts === 0 &&
    data.non_bcrypt_passwords === 0 && data.active_super_admins >= 1;

  console.log(JSON.stringify(
    { ready, migrations: migrationFiles, missingMigrations, changedMigrations, data },
    null,
    2,
  ));
  if (!ready) throw new Error("La base todavía no cumple la verificación operativa.");
}

verifyReadiness()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

