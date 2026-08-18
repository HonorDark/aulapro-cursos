import { Router } from "express";
import { z } from "zod";
import { query } from "../config/database";
import { authenticate, authorize } from "../middleware/auth";
import { audit } from "../services/audit";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/errors";
const router = Router();
router.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));
router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT (SELECT COUNT(*) FROM users WHERE role='STUDENT')::int students,(SELECT COUNT(*) FROM courses)::int courses,(SELECT COUNT(*) FROM enrollments)::int enrollments,(SELECT COUNT(*) FROM enrollments WHERE completed_at IS NOT NULL)::int completions`,
    );
    res.json({ success: true, data: rows[0] });
  }),
);
router.get(
  "/students",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT u.id,u.name,u.email,u.is_active,u.created_at,COUNT(e.id)::int enrollments FROM users u LEFT JOIN enrollments e ON e.user_id=u.id WHERE u.role='STUDENT' GROUP BY u.id ORDER BY u.created_at DESC`,
    );
    res.json({ success: true, data: rows });
  }),
);
router.get(
  "/students/:id",
  asyncHandler(async (req, res) => {
    const student = await query(
      `SELECT u.id,u.name,u.email,u.avatar_url,u.is_active,u.created_at,
        COUNT(DISTINCT e.id)::int enrollments,
        COUNT(DISTINCT p.id)::int payments
       FROM users u
       LEFT JOIN enrollments e ON e.user_id=u.id
       LEFT JOIN payments p ON p.user_id=u.id
       WHERE u.id=$1 AND u.role='STUDENT'
       GROUP BY u.id`,
      [req.params.id],
    );
    if (!student.rows[0]) throw new AppError(404, "Estudiante no encontrado");

    const enrollments = await query(
      `SELECT e.id,e.course_id,e.enrolled_at,e.completed_at,c.title,c.image_url,
        COUNT(DISTINCT l.id)::int lesson_count,
        COUNT(DISTINCT lp.id) FILTER(WHERE lp.completed)::int completed_count,
        CASE WHEN COUNT(DISTINCT l.id)=0 THEN 0
          ELSE ROUND(COUNT(DISTINCT lp.id) FILTER(WHERE lp.completed)*100.0/COUNT(DISTINCT l.id))
        END::int progress
       FROM enrollments e
       JOIN courses c ON c.id=e.course_id
       LEFT JOIN modules m ON m.course_id=c.id
       LEFT JOIN lessons l ON l.module_id=m.id
       LEFT JOIN lesson_progress lp ON lp.enrollment_id=e.id AND lp.lesson_id=l.id
       WHERE e.user_id=$1
       GROUP BY e.id,c.id
       ORDER BY e.enrolled_at DESC`,
      [req.params.id],
    );
    res.json({
      success: true,
      data: { ...student.rows[0], courses: enrollments.rows },
    });
  }),
);
router.patch(
  "/students/:id",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(2).max(120),
        email: z.string().email(),
        isActive: z.boolean(),
      })
      .parse(req.body);
    const { rows } = await query(
      `UPDATE users SET name=$1,email=LOWER($2),is_active=$3
       WHERE id=$4 AND role='STUDENT'
       RETURNING id,name,email,is_active,created_at`,
      [body.name, body.email, body.isActive, req.params.id],
    );
    if (!rows[0]) throw new AppError(404, "Estudiante no encontrado");
    await audit(
      req.user!.id,
      "STUDENT_UPDATED",
      "user",
      String(req.params.id),
      {
        isActive: body.isActive,
      },
    );
    res.json({ success: true, data: rows[0] });
  }),
);
router.delete(
  "/students/:id",
  asyncHandler(async (req, res) => {
    const target = await query<{
      id: string;
      name: string;
      is_active: boolean;
    }>("SELECT id,name,is_active FROM users WHERE id=$1 AND role='STUDENT'", [
      req.params.id,
    ]);
    if (!target.rows[0]) throw new AppError(404, "Estudiante no encontrado");
    await query(
      "UPDATE users SET is_active=false WHERE id=$1 AND role='STUDENT'",
      [req.params.id],
    );
    await audit(
      req.user!.id,
      "STUDENT_DEACTIVATED",
      "user",
      String(req.params.id),
      {
        name: target.rows[0].name,
        previousStatus: target.rows[0].is_active,
      },
    );
    res.json({
      success: true,
      data: { id: req.params.id, is_active: false },
      message: "Estudiante desactivado; sus datos fueron conservados",
    });
  }),
);
router.get(
  "/enrollments",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      "SELECT e.*,u.name student_name,u.email,c.title course_title FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id ORDER BY e.enrolled_at DESC",
    );
    res.json({ success: true, data: rows });
  }),
);
router.get(
  "/activity",
  authorize("SUPER_ADMIN"),
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      "SELECT a.*,u.name actor_name,u.email actor_email FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100",
    );
    res.json({ success: true, data: rows });
  }),
);
router.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    const [courses, history, activity] = await Promise.all([
      query(
        `SELECT c.id,c.title,c.instructor,c.level,COUNT(DISTINCT e.id)::int students,CASE WHEN COUNT(DISTINCT l.id)=0 THEN 0 ELSE ROUND(COUNT(lp.id) FILTER(WHERE lp.completed)*100.0/NULLIF(COUNT(DISTINCT e.id)*COUNT(DISTINCT l.id),0)) END::int progress FROM courses c LEFT JOIN enrollments e ON e.course_id=c.id LEFT JOIN modules m ON m.course_id=c.id LEFT JOIN lessons l ON l.module_id=m.id LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.enrollment_id=e.id WHERE c.is_published=true GROUP BY c.id ORDER BY students DESC LIMIT 6`,
      ),
      query(
        `WITH months AS (SELECT generate_series(date_trunc('month',NOW())-INTERVAL '5 months',date_trunc('month',NOW()),INTERVAL '1 month') AS month_start) SELECT to_char(m.month_start,'Mon') label,COUNT(lp.id) FILTER(WHERE lp.completed)::int completed FROM months m LEFT JOIN lesson_progress lp ON date_trunc('month',lp.completed_at)=m.month_start GROUP BY m.month_start ORDER BY m.month_start`,
      ),
      query(
        `SELECT a.id,a.action,a.created_at,u.name actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 8`,
      ),
    ]);
    res.json({
      success: true,
      data: {
        courses: courses.rows,
        history: history.rows,
        activity: activity.rows,
      },
    });
  }),
);
export default router;
