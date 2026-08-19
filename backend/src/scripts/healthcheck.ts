import { pool } from "../config/database";
import { env } from "../config/env";

async function healthcheck() {
  const response = await fetch(`http://127.0.0.1:${env.port}/api/health`, {
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) throw new Error(`API respondió ${response.status}`);
  await pool.query("SELECT 1");
}

healthcheck()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error("Healthcheck fallido", error);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });

