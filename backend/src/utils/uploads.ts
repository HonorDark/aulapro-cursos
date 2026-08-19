import { AppError } from "./errors";

export type SupportedUploadMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "application/pdf";

export function validateUploadDataUrl(
  dataUrl: string,
  mime: SupportedUploadMime,
  maxBytes = 5 * 1024 * 1024,
) {
  const prefix = `data:${mime};base64,`;
  if (!dataUrl.startsWith(prefix)) {
    throw new AppError(400, "El archivo no tiene un formato válido");
  }

  const encoded = dataUrl.slice(prefix.length);
  if (
    !encoded ||
    encoded.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
  ) {
    throw new AppError(400, "El archivo contiene datos inválidos");
  }

  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > maxBytes) {
    throw new AppError(
      400,
      `El archivo debe pesar como máximo ${Math.floor(maxBytes / 1024 / 1024)} MB`,
    );
  }

  const signatureMatches =
    (mime === "image/jpeg" &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (mime === "image/png" &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mime === "image/webp" &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP") ||
    (mime === "application/pdf" &&
      bytes.subarray(0, 5).toString("ascii") === "%PDF-");

  if (!signatureMatches) {
    throw new AppError(
      400,
      "El contenido no coincide con el tipo de archivo indicado",
    );
  }
}

export function validateImageDataUrl(
  dataUrl: string,
  maxBytes = 2 * 1024 * 1024,
) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(dataUrl);
  if (!match) throw new AppError(400, "La imagen no tiene un formato válido");
  validateUploadDataUrl(
    dataUrl,
    match[1] as Exclude<SupportedUploadMime, "application/pdf">,
    maxBytes,
  );
}
