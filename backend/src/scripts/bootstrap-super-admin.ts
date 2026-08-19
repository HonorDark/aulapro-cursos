import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../config/database";
import { securePasswordSchema } from "../utils/password";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable obligatoria ${name}.`);
  return value;
}

async function bootstrapSuperAdmin() {
  const { name, email, password } = z
    .object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
      password: securePasswordSchema(12),
    })
    .parse({
      name: required("BOOTSTRAP_ADMIN_NAME"),
      email: required("BOOTSTRAP_ADMIN_EMAIL"),
      password: required("BOOTSTRAP_ADMIN_PASSWORD"),
    });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('aulaflow:bootstrap-super-admin'))",
    );
    const existing = await client.query(
      "SELECT id FROM users WHERE role='SUPER_ADMIN' AND is_active=true FOR UPDATE",
    );
    if (existing.rowCount) {
      throw new Error("Ya existe un SUPER_ADMIN activo; no se creó otra cuenta.");
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO users(name,email,password_hash,role,is_active)
       VALUES($1,$2,$3,'SUPER_ADMIN',true)`,
      [name, email, passwordHash],
    );
    await client.query("COMMIT");
    console.log(`SUPER_ADMIN inicial creado: ${email}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

bootstrapSuperAdmin().catch((error: unknown) => {
  console.error("No se pudo crear el SUPER_ADMIN inicial.", error);
  process.exitCode = 1;
});
