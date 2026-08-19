import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../config/database";

type AppliedMigration = { file_name: string; checksum: string };

const migrationsDirectory = path.resolve(
  __dirname,
  "../../database/migrations",
);

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [
      "aulaflow:database-migrations",
    ]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        file_name TEXT PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = (await fs.readdir(migrationsDirectory))
      .filter((file) => /^\d+.*\.sql$/i.test(file))
      .sort((left, right) => left.localeCompare(right));

    for (const fileName of files) {
      const sql = await fs.readFile(path.join(migrationsDirectory, fileName), "utf8");
      const executableSql = sql
        .split(/\r?\n/)
        .filter((line) => !line.trimStart().startsWith("\\encoding"))
        .join("\n");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      const applied = await client.query<AppliedMigration>(
        "SELECT file_name,checksum FROM schema_migrations WHERE file_name=$1",
        [fileName],
      );

      if (applied.rows[0]) {
        if (applied.rows[0].checksum !== checksum) {
          throw new Error(`La migración aplicada ${fileName} fue modificada.`);
        }
        console.log(`Migración ya aplicada: ${fileName}`);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(executableSql);
        await client.query(
          "INSERT INTO schema_migrations(file_name,checksum) VALUES($1,$2)",
          [fileName, checksum],
        );
        await client.query("COMMIT");
        console.log(`Migración aplicada: ${fileName}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [
      "aulaflow:database-migrations",
    ]).catch(() => undefined);
    client.release();
    await pool.end();
  }
}

migrate().catch((error: unknown) => {
  console.error("No se pudieron aplicar las migraciones.", error);
  process.exitCode = 1;
});

