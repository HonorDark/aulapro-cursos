import { Router } from "express";
import { z } from "zod";
import { query } from "../config/database";
import { authenticate, authorize } from "../middleware/auth";
import { audit } from "../services/audit";
import { ensureProfileSchema } from "../services/profileSchema";
import { ensureCourseworkSchema } from "../services/courseworkSchema";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/errors";
import { httpUrl } from "../utils/validation";
import { validateImageDataUrl } from "../utils/uploads";
const router = Router();
router.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));
router.use(
  asyncHandler(async (_req, _res, next) => {
    await Promise.all([ensureProfileSchema(), ensureCourseworkSchema()]);
    next();
  }),
);
router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role='STUDENT' AND is_active=true)::int students,
        (SELECT COUNT(*) FROM courses WHERE is_published=true)::int courses,
        (SELECT COUNT(*) FROM enrollments WHERE access_status='ACTIVE')::int enrollments,
        (SELECT COUNT(*) FROM enrollments WHERE access_status='ACTIVE' AND completed_at IS NOT NULL)::int completions,
        (SELECT COUNT(*) FROM payments WHERE status='PENDING')::int pending_payments,
        ((SELECT COUNT(*) FROM assignment_submissions WHERE status='SUBMITTED')+
         (SELECT COUNT(*) FROM evaluation_submissions WHERE status='SUBMITTED')+
         (SELECT COUNT(*) FROM survey_responses WHERE status='SUBMITTED'))::int pending_submissions,
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='APPROVED') approved_revenue`,
    );
    res.json({ success: true, data: rows[0] });
  }),
);
router.get(
  "/students",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT u.id,u.name,u.email,u.avatar_url,u.phone,u.document_number,u.country,u.city,
       u.is_active,u.created_at,COUNT(e.id)::int enrollments,
       ((u.phone IS NOT NULL)::int+(u.document_number IS NOT NULL)::int+
        (u.country IS NOT NULL)::int+(u.city IS NOT NULL)::int+
        (u.birth_date IS NOT NULL)::int+(u.address IS NOT NULL)::int+(u.bio IS NOT NULL)::int)::int profile_fields
       FROM users u LEFT JOIN enrollments e ON e.user_id=u.id
       WHERE u.role='STUDENT' GROUP BY u.id ORDER BY u.created_at DESC`,
    );
    res.json({ success: true, data: rows });
  }),
);
router.get(
  "/students/:id",
  asyncHandler(async (req, res) => {
    const student = await query(
      `SELECT u.id,u.name,u.email,u.avatar_url,u.phone,u.document_number,
        u.country,u.city,u.address,u.birth_date,u.bio,u.is_active,u.created_at,
        COUNT(DISTINCT e.id)::int enrollments,
        COUNT(DISTINCT p.id)::int payments,
        ((u.phone IS NOT NULL)::int+(u.document_number IS NOT NULL)::int+
         (u.country IS NOT NULL)::int+(u.city IS NOT NULL)::int+
         (u.birth_date IS NOT NULL)::int+(u.address IS NOT NULL)::int+
         (u.bio IS NOT NULL)::int)::int profile_fields
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
        avatarUrl: z
          .union([
            httpUrl(2048),
            z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(3_000_000),
            z.null(),
          ])
          .optional(),
        phone: z.string().trim().max(30).nullable().optional(),
        documentNumber: z.string().trim().max(40).nullable().optional(),
        country: z.string().trim().max(80).nullable().optional(),
        city: z.string().trim().max(100).nullable().optional(),
        address: z.string().trim().max(220).nullable().optional(),
        birthDate: z
          .union([
            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            z.literal(""),
            z.null(),
          ])
          .optional(),
        bio: z.string().trim().max(500).nullable().optional(),
      })
      .parse(req.body);
    if (body.avatarUrl?.startsWith("data:")) {
      validateImageDataUrl(body.avatarUrl, 2 * 1024 * 1024);
    }
    const value = (input: string | null | undefined) => input?.trim() || null;
    const { rows } = await query(
      `UPDATE users SET name=$1,email=LOWER($2),is_active=$3,
       token_version=token_version+CASE WHEN is_active<>$3 THEN 1 ELSE 0 END,
       avatar_url=$4,
       phone=$5,document_number=$6,country=$7,city=$8,address=$9,birth_date=$10,bio=$11
       WHERE id=$12 AND role='STUDENT'
       RETURNING id,name,email,avatar_url,phone,document_number,country,city,address,
       birth_date,bio,is_active,created_at`,
      [
        body.name,
        body.email,
        body.isActive,
        body.avatarUrl ?? null,
        value(body.phone),
        value(body.documentNumber),
        value(body.country),
        value(body.city),
        value(body.address),
        body.birthDate || null,
        value(body.bio),
        req.params.id,
      ],
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
      `UPDATE users SET is_active=false,
       token_version=token_version+CASE WHEN is_active THEN 1 ELSE 0 END
       WHERE id=$1 AND role='STUDENT'`,
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
        `SELECT c.id,c.title,c.instructor,c.level,COUNT(DISTINCT e.id)::int students,CASE WHEN COUNT(DISTINCT l.id)=0 THEN 0 ELSE ROUND(COUNT(lp.id) FILTER(WHERE lp.completed)*100.0/NULLIF(COUNT(DISTINCT e.id)*COUNT(DISTINCT l.id),0)) END::int progress FROM courses c LEFT JOIN enrollments e ON e.course_id=c.id AND e.access_status='ACTIVE' LEFT JOIN modules m ON m.course_id=c.id LEFT JOIN lessons l ON l.module_id=m.id LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.enrollment_id=e.id WHERE c.is_published=true GROUP BY c.id ORDER BY students DESC LIMIT 6`,
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
router.get(
  "/super-dashboard",
  authorize("SUPER_ADMIN"),
  asyncHandler(async (_req, res) => {
    const [summary, roles, adminActivity, newestUsers] = await Promise.all([
      query(
        `SELECT COUNT(*)::int total_users,
          COUNT(*) FILTER(WHERE is_active)::int active_users,
          COUNT(*) FILTER(WHERE NOT is_active)::int inactive_users,
          COUNT(*) FILTER(WHERE role='ADMIN')::int admins,
          COUNT(*) FILTER(WHERE role='ADMIN' AND is_active)::int active_admins,
          COUNT(*) FILTER(WHERE role='SUPER_ADMIN')::int super_admins,
          (SELECT COUNT(*) FROM audit_logs WHERE created_at>=date_trunc('day',NOW()))::int actions_today
         FROM users`,
      ),
      query(
        `SELECT role,COUNT(*)::int total,COUNT(*) FILTER(WHERE is_active)::int active
         FROM users GROUP BY role ORDER BY role`,
      ),
      query(
        `SELECT a.id,a.action,a.entity_type,a.entity_id,a.created_at,
          u.name actor_name,u.email actor_email,u.role actor_role
         FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id
         WHERE u.role IN ('ADMIN','SUPER_ADMIN')
         ORDER BY a.created_at DESC LIMIT 8`,
      ),
      query(
        `SELECT id,name,email,role,is_active,created_at FROM users
         ORDER BY created_at DESC LIMIT 6`,
      ),
    ]);
    res.json({
      success: true,
      data: {
        summary: summary.rows[0],
        roles: roles.rows,
        admin_activity: adminActivity.rows,
        newest_users: newestUsers.rows,
      },
    });
  }),
);
export default router;
