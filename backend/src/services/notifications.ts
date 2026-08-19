import { query } from "../config/database";

/** La tabla se instala mediante `npm run migrate`, nunca en una petición. */
export async function ensureNotificationsSchema() {
  return undefined;
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
