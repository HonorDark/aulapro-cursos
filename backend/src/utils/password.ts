import { z } from "zod";

export const securePasswordSchema = (minimumLength = 8) =>
  z
    .string()
    .min(minimumLength)
    .max(72)
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "La contraseña no puede superar 72 bytes",
    );
