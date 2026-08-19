import type { Request, RequestHandler } from "express";
import { env } from "../config/env";

type LimitEntry = { count: number; resetAt: number };

type RateLimitOptions = {
  windowMs: number;
  max: number;
  skip?: (req: Request) => boolean;
};

const clientKey = (req: Request) => req.ip || req.socket.remoteAddress || "unknown";

export const rateLimit = ({ windowMs, max, skip }: RateLimitOptions): RequestHandler => {
  const entries = new Map<string, LimitEntry>();

  return (req, res, next) => {
    if (skip?.(req)) return next();

    const now = Date.now();
    const key = clientKey(req);
    let entry = entries.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      entries.set(key, entry);
    }
    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1_000));
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSeconds));

    if (entries.size > 10_000) {
      for (const [storedKey, stored] of entries) {
        if (stored.resetAt <= now) entries.delete(storedKey);
      }
    }

    if (entry.count > max) {
      res.setHeader("Retry-After", String(resetSeconds));
      return res.status(429).json({
        success: false,
        message: "Demasiadas solicitudes. Intenta nuevamente en unos minutos.",
      });
    }
    next();
  };
};

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.setHeader("Cache-Control", "no-store");
  if (env.isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
};

export const apiRateLimit = rateLimit({ windowMs: 15 * 60_000, max: 500 });
export const authRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 30,
  skip: (req) => req.method === "GET",
});
