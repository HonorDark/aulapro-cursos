import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { query } from "../config/database";
import { env } from "../config/env";
import type { Role } from "../types";
import { AppError } from "../utils/errors";

type Payload = { sub: string; ver: number };
type SessionUser = {
  id: string;
  role: Role;
  email: string;
  is_active: boolean;
  token_version: number;
};

export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return next(new AppError(401, "Debes iniciar sesión"));

  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
    }) as Payload;
    if (!payload.sub || !Number.isInteger(payload.ver)) {
      return next(new AppError(401, "La sesión no es válida"));
    }
    const { rows } = await query<SessionUser>(
      "SELECT id,role,email,is_active,token_version FROM users WHERE id=$1",
      [payload.sub],
    );
    const user = rows[0];
    if (!user?.is_active) {
      return next(new AppError(401, "La cuenta está desactivada"));
    }
    if (payload.ver !== user.token_version) {
      return next(
        new AppError(401, "La sesión fue revocada. Inicia sesión nuevamente"),
      );
    }
    req.user = { id: user.id, role: user.role, email: user.email };
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    next(new AppError(401, "La sesión expiró o no es válida"));
  }
};

export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(403, "No tienes permiso para realizar esta acción"),
      );
    }
    next();
  };
