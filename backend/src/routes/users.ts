import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../config/database";
import { authenticate, authorize } from "../middleware/auth";
import { audit } from "../services/audit";
import { ensureProfileSchema } from "../services/profileSchema";
import type { Role } from "../types";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/errors";
import { httpUrl } from "../utils/validation";
import { validateImageDataUrl } from "../utils/uploads";
import { securePasswordSchema } from "../utils/password";

const router = Router();
router.use(authenticate);

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar_url: string | null;
  phone: string | null;
  document_number: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  birth_date: Date | string | null;
  bio: string | null;
  is_active: boolean;
  created_at: Date;
};

const profileColumns = `id,name,email,role,avatar_url,phone,document_number,
  country,city,address,birth_date,bio,is_active,created_at`;

const profileJson = (row: ProfileRow) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  avatarUrl: row.avatar_url,
  phone: row.phone,
  documentNumber: row.document_number,
  country: row.country,
  city: row.city,
  address: row.address,
  birthDate: row.birth_date
    ? row.birth_date instanceof Date
      ? row.birth_date.toISOString().slice(0, 10)
      : String(row.birth_date).slice(0, 10)
    : null,
  bio: row.bio,
  isActive: row.is_active,
  createdAt: row.created_at.toISOString(),
});

async function setUserActive(
  targetId: string,
  actorId: string,
  isActive: boolean,
) {
  if (targetId === actorId && !isActive) {
    throw new AppError(400, "No puedes desactivar tu propia cuenta");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!isActive) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        "aulaflow:super-admin-status",
      ]);
    }
    const target = await client.query<{
      id: string;
      role: Role;
      is_active: boolean;
    }>("SELECT id,role,is_active FROM users WHERE id=$1 FOR UPDATE", [targetId]);
    const user = target.rows[0];
    if (!user) throw new AppError(404, "Usuario no encontrado");

    if (user.role === "SUPER_ADMIN" && user.is_active && !isActive) {
      const superAdmins = await client.query<{ id: string; is_active: boolean }>(
        "SELECT id,is_active FROM users WHERE role='SUPER_ADMIN' FOR UPDATE",
      );
      if (superAdmins.rows.filter((item) => item.is_active).length <= 1) {
        throw new AppError(400, "No se puede desactivar al último SUPER_ADMIN");
      }
    }

    const updated = await client.query(
      `UPDATE users SET is_active=$1,
       token_version=token_version+CASE WHEN is_active<>$1 THEN 1 ELSE 0 END
       WHERE id=$2 RETURNING id,name,email,role,is_active,created_at`,
      [isActive, targetId],
    );
    await client.query(
      `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata)
       VALUES($1,$2,'user',$3,$4::jsonb)`,
      [
        actorId,
        isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
        targetId,
        JSON.stringify({ previousStatus: user.is_active, isActive }),
      ],
    );
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const optionalText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  avatarUrl: z
    .union([
      httpUrl(2048),
      z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(3_000_000),
      z.null(),
    ])
    .optional(),
  phone: optionalText(30),
  documentNumber: optionalText(40),
  country: optionalText(80),
  city: optionalText(100),
  address: optionalText(220),
  birthDate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
    .optional(),
  bio: optionalText(500),
});

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    await ensureProfileSchema();
    const { rows } = await query<ProfileRow>(
      `SELECT ${profileColumns} FROM users WHERE id=$1`,
      [req.user!.id],
    );
    if (!rows[0]) throw new AppError(404, "Perfil no encontrado");
    res.json({ success: true, data: profileJson(rows[0]) });
  }),
);

router.patch(
  "/me",
  asyncHandler(async (req, res) => {
    await ensureProfileSchema();
    const body = profileSchema.parse(req.body);
    if (body.avatarUrl?.startsWith("data:")) {
      validateImageDataUrl(body.avatarUrl, 2 * 1024 * 1024);
    }
    const value = (input: string | null | undefined) => input?.trim() || null;
    const { rows } = await query<ProfileRow>(
      `UPDATE users SET name=$1,avatar_url=$2,phone=$3,document_number=$4,
       country=$5,city=$6,address=$7,birth_date=$8,bio=$9
       WHERE id=$10 RETURNING ${profileColumns}`,
      [
        body.name,
        body.avatarUrl ?? null,
        value(body.phone),
        value(body.documentNumber),
        value(body.country),
        value(body.city),
        value(body.address),
        body.birthDate || null,
        value(body.bio),
        req.user!.id,
      ],
    );
    if (!rows[0]) throw new AppError(404, "Perfil no encontrado");
    await audit(req.user!.id, "PROFILE_UPDATED", "user", req.user!.id);
    res.json({ success: true, data: profileJson(rows[0]) });
  }),
);

router.get(
  "/",
  authorize("SUPER_ADMIN"),
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      "SELECT id,name,email,role,avatar_url,is_active,created_at FROM users ORDER BY created_at DESC",
    );
    res.json({ success: true, data: rows });
  }),
);

router.post(
  "/admins",
  authorize("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(255),
        password: securePasswordSchema(),
      })
      .parse(req.body);
    const { rows } = await query(
      `INSERT INTO users(name,email,password_hash,role)
       VALUES($1,LOWER($2),$3,'ADMIN')
       RETURNING id,name,email,role,is_active,created_at`,
      [body.name, body.email, await bcrypt.hash(body.password, 12)],
    );
    await audit(
      req.user!.id,
      "ADMIN_CREATED",
      "user",
      (rows[0] as { id: string }).id,
    );
    res.status(201).json({ success: true, data: rows[0] });
  }),
);

router.patch(
  "/:id/role",
  authorize("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const targetId = z.string().uuid().parse(req.params.id);
    const { role } = z
      .object({ role: z.enum(["STUDENT", "ADMIN"]) })
      .parse(req.body);
    if (targetId === req.user!.id) {
      throw new AppError(400, "No puedes cambiar tu propio rol");
    }
    const target = await query<{ role: Role }>(
      "SELECT role FROM users WHERE id=$1",
      [targetId],
    );
    if (!target.rows[0]) throw new AppError(404, "Usuario no encontrado");
    if (target.rows[0].role === "SUPER_ADMIN") {
      throw new AppError(403, "No puedes modificar otro SUPER_ADMIN");
    }
    const { rows } = await query(
      `UPDATE users SET role=$1,token_version=token_version+1
       WHERE id=$2 RETURNING id,name,email,role,is_active,created_at`,
      [role, targetId],
    );
    await audit(req.user!.id, "USER_ROLE_CHANGED", "user", targetId, {
      role,
    });
    res.json({ success: true, data: rows[0] });
  }),
);

router.patch(
  "/:id/status",
  authorize("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const targetId = z.string().uuid().parse(req.params.id);
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const updated = await setUserActive(targetId, req.user!.id, isActive);
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const targetId = z.string().uuid().parse(req.params.id);
    await setUserActive(targetId, req.user!.id, false);
    res.json({ success: true, message: "Usuario desactivado; sus datos se conservaron" });
  }),
);

export default router;
