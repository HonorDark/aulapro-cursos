import "dotenv/config";

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

const required = (name: string, developmentFallback?: string) => {
  const value = process.env[name]?.trim() || developmentFallback;
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
};

const integer = (name: string, fallback: number, min: number, max: number) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} debe ser un entero entre ${min} y ${max}`);
  }
  return value;
};

const databaseUrl = required(
  "DATABASE_URL",
  isProduction
    ? undefined
    : "postgresql://postgres:postgres@localhost:5432/aulapro",
);
const jwtSecret = required(
  "JWT_SECRET",
  isProduction ? undefined : "dev-only-change-this-secret",
);

if (isProduction && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET debe tener al menos 32 caracteres en producción");
}

const frontendUrls = required(
  "FRONTEND_URL",
  isProduction ? undefined : "http://localhost:5173",
)
  .split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

export const env = {
  nodeEnv,
  isProduction,
  port: integer("PORT", 4000, 1, 65_535),
  databaseUrl,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || "8h",
  frontendUrl: frontendUrls[0]!,
  frontendUrls,
  trustProxy: integer("TRUST_PROXY", 0, 0, 10),
};
