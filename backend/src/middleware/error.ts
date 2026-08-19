import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";

type HttpLikeError = Error & {
  code?: string;
  status?: number;
  type?: string;
};

export const notFound: RequestHandler = (_req, _res, next) =>
  next(new AppError(404, "Ruta no encontrada"));

export const errorHandler: ErrorRequestHandler = (error: HttpLikeError, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Datos inválidos",
      errors: error.flatten().fieldErrors,
    });
  }
  if (error instanceof AppError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
  }
  if (error.type === "entity.too.large" || error.status === 413) {
    return res.status(413).json({
      success: false,
      message: "El archivo o la solicitud supera el tamaño permitido",
    });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "JSON inválido" });
  }
  if (error.code === "23505") {
    return res.status(409).json({ success: false, message: "El registro ya existe" });
  }
  if (error.code === "23503") {
    return res.status(409).json({
      success: false,
      message: "La operación entra en conflicto con datos relacionados",
    });
  }
  if (error.code === "23514" || error.code === "22P02") {
    return res.status(400).json({ success: false, message: "Datos inválidos" });
  }
  console.error(error);
  return res.status(500).json({
    success: false,
    message: "Error interno del servidor",
  });
};
