import { query } from "../config/database";

let schemaPromise: Promise<unknown> | null = null;

export function ensureNotificationsSchema() {
  schemaPromise ??= query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(160) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'INFO' CHECK(type IN ('INFO','SUCCESS','WARNING','ERROR')),
      href TEXT,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications(user_id,is_read) WHERE is_read=false;
  `).catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  options: {
    type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
    href?: string;
  } = {},
) {
  await ensureNotificationsSchema();
  return query(
    `INSERT INTO notifications(user_id,title,message,type,href)
     VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [userId, title, message, options.type ?? "INFO", options.href ?? null],
  );
}

export async function createRoleNotification(
  roles: Array<"STUDENT" | "ADMIN" | "SUPER_ADMIN">,
  title: string,
  message: string,
  options: {
    type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
    href?: string;
  } = {},
) {
  await ensureNotificationsSchema();
  return query(
    `INSERT INTO notifications(user_id,title,message,type,href)
     SELECT id,$1,$2,$3,$4 FROM users WHERE role=ANY($5::user_role[]) AND is_active=true`,
    [title, message, options.type ?? "INFO", options.href ?? null, roles],
  );
}
