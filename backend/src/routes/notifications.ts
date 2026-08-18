import { Router } from "express";
import { query } from "../config/database";
import { authenticate } from "../middleware/auth";
import { ensureNotificationsSchema } from "../services/notifications";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/errors";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await ensureNotificationsSchema();
    await query(
      `INSERT INTO notifications(user_id,title,message,type,href)
       SELECT $1,'Bienvenido a AulaFlow','Tu centro de notificaciones ya está activo. Aquí recibirás novedades importantes.','INFO',
       CASE WHEN $2='STUDENT' THEN '/student' WHEN $2='ADMIN' THEN '/admin' ELSE '/super-admin' END
       WHERE NOT EXISTS(SELECT 1 FROM notifications WHERE user_id=$1)`,
      [req.user!.id, req.user!.role],
    );
    const { rows } = await query(
      `SELECT id,title,message,type,href,is_read,created_at,read_at
       FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`,
      [req.user!.id],
    );
    res.json({
      success: true,
      data: {
        items: rows,
        unread: rows.filter((item) => !(item as { is_read: boolean }).is_read)
          .length,
      },
    });
  }),
);

router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await ensureNotificationsSchema();
    await query(
      "UPDATE notifications SET is_read=true,read_at=COALESCE(read_at,NOW()) WHERE user_id=$1 AND is_read=false",
      [req.user!.id],
    );
    res.json({ success: true, data: { unread: 0 } });
  }),
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await ensureNotificationsSchema();
    const { rows } = await query(
      `UPDATE notifications SET is_read=true,read_at=COALESCE(read_at,NOW())
       WHERE id=$1 AND user_id=$2 RETURNING id,is_read,read_at`,
      [req.params.id, req.user!.id],
    );
    if (!rows[0]) throw new AppError(404, "Notificación no encontrada");
    res.json({ success: true, data: rows[0] });
  }),
);

export default router;
