import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { pool, query } from "../config/database";
import { env } from "../config/env";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/errors";
import { publicUser } from "../utils/user";
import type { Role } from "../types";
import { securePasswordSchema } from "../utils/password";

const router = Router();
const userCols =
  "id,name,email,role,avatar_url,is_active,created_at,token_version";
type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  avatar_url: string | null;
  is_active: boolean;
  created_at: Date;
  token_version: number;
};

const tokenFor = (user: UserRow) =>
  jwt.sign({ ver: user.token_version }, env.jwtSecret, {
    algorithm: "HS256",
    subject: user.id,
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });

const passwordSchema = securePasswordSchema();

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(255),
        password: passwordSchema,
      })
      .parse(req.body);
    const hash = await bcrypt.hash(body.password, 12);
    const { rows } = await query<UserRow>(
      `INSERT INTO users(name,email,password_hash,role)
       VALUES($1,LOWER($2),$3,'STUDENT')
       RETURNING ${userCols},password_hash`,
      [body.name, body.email, hash],
    );
    const user = rows[0]!;
    res.status(201).json({
      success: true,
      data: { token: tokenFor(user), user: publicUser(user) },
    });
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = z
      .object({ email: z.string().trim().email().max(255), password: securePasswordSchema(1) })
      .parse(req.body);
    const { rows } = await query<UserRow>(
      "SELECT * FROM users WHERE LOWER(email)=LOWER($1)",
      [body.email],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
      throw new AppError(401, "Correo o contraseña incorrectos");
    }
    if (!user.is_active) throw new AppError(403, "Tu cuenta está desactivada");
    res.json({
      success: true,
      data: { token: tokenFor(user), user: publicUser(user) },
    });
  }),
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const { rows } = await query<UserRow>(
      `SELECT ${userCols},password_hash FROM users WHERE id=$1`,
      [req.user!.id],
    );
    const user = rows[0];
    if (!user?.is_active)
      throw new AppError(401, "La cuenta ya no está disponible");
    res.json({ success: true, data: publicUser(user) });
  }),
);

router.post(
  "/change-password",
  authenticate,
  asyncHandler(async (req, res) => {
    const body = z
      .object({ currentPassword: z.string().min(1).max(72), newPassword: passwordSchema })
      .parse(req.body);
    const nextHash = await bcrypt.hash(body.newPassword, 12);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<UserRow>(
        "SELECT * FROM users WHERE id=$1 AND is_active=true FOR UPDATE",
        [req.user!.id],
      );
      const user = result.rows[0];
      if (!user) throw new AppError(401, "La cuenta ya no está disponible");
      if (!(await bcrypt.compare(body.currentPassword, user.password_hash))) {
        throw new AppError(400, "La contraseña actual no coincide");
      }
      if (await bcrypt.compare(body.newPassword, user.password_hash)) {
        throw new AppError(400, "La nueva contraseña debe ser diferente");
      }
      await client.query(
        "UPDATE users SET password_hash=$1,token_version=token_version+1 WHERE id=$2",
        [nextHash, user.id],
      );
      await client.query(
        "UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL",
        [user.id],
      );
      await client.query("COMMIT");
      res.json({
        success: true,
        message: "Contraseña actualizada. Inicia sesión nuevamente.",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const { email } = z
      .object({ email: z.string().trim().email().max(255) })
      .parse(req.body);
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    let tokenCreated = false;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string }>(
        "SELECT id FROM users WHERE LOWER(email)=LOWER($1) AND is_active=true FOR UPDATE",
        [email],
      );
      if (result.rows[0]) {
        await client.query(
          "UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL",
          [result.rows[0].id],
        );
        await client.query(
          `INSERT INTO password_reset_tokens(user_id,token_hash,expires_at)
           VALUES($1,$2,NOW()+INTERVAL '30 minutes')`,
          [result.rows[0].id, tokenHash],
        );
        tokenCreated = true;
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    res.json({
      success: true,
      message: "Si la cuenta existe, se generó un enlace de recuperación",
      ...(!env.isProduction && tokenCreated ? { data: { resetToken } } : {}),
    });
  }),
);

router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const body = z
      .object({ token: z.string().regex(/^[a-f0-9]{64}$/i), password: passwordSchema })
      .parse(req.body);
    const tokenHash = crypto.createHash("sha256").update(body.token).digest("hex");
    const passwordHash = await bcrypt.hash(body.password, 12);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string; user_id: string }>(
        `UPDATE password_reset_tokens
         SET used_at=NOW()
         WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW()
         RETURNING id,user_id`,
        [tokenHash],
      );
      const reset = result.rows[0];
      if (!reset) throw new AppError(400, "El token no es válido o expiró");
      const updated = await client.query(
        `UPDATE users SET password_hash=$1,token_version=token_version+1
         WHERE id=$2 AND is_active=true RETURNING id`,
        [passwordHash, reset.user_id],
      );
      if (!updated.rows[0]) throw new AppError(403, "La cuenta no está disponible");
      await client.query(
        "UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL",
        [reset.user_id],
      );
      await client.query("COMMIT");
      res.json({
        success: true,
        message: "Contraseña restablecida. Inicia sesión nuevamente.",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

export default router;
