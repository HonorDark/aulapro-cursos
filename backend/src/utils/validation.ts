import { z } from "zod";

export const httpUrl = (maxLength = 2048) =>
  z
    .string()
    .trim()
    .url()
    .max(maxLength)
    .refine(
      (value) => /^https?:\/\//i.test(value),
      "La URL debe usar http o https",
    );
