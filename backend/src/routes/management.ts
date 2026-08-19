import { Router } from "express";
import { z } from "zod";
import { query } from "../config/database";
import { authenticate, authorize } from "../middleware/auth";
import { audit } from "../services/audit";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/errors";
import { httpUrl } from "../utils/validation";
import { validateImageDataUrl } from "../utils/uploads";

const router = Router();
router.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));

const id = z.string().uuid();
const categoryBody = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});

router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const result = await query(
      `SELECT c.id,c.name,c.slug,c.description,c.is_active,c.created_at,
        COUNT(co.id)::int course_count
       FROM categories c LEFT JOIN courses co ON co.category_id=c.id
       GROUP BY c.id ORDER BY c.is_active DESC,c.name`,
    );
    res.json({ success: true, data: result.rows });
  }),
);

router.post(
  "/categories",
  authorize("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const body = categoryBody.parse(req.body);
    const result = await query<{ id: string }>(
      `INSERT INTO categories(name,slug,description,is_active)
       VALUES($1,$2,$3,$4) RETURNING *`,
      [body.name, body.slug, body.description || null, body.isActive],
    );
    await audit(
      req.user!.id,
      "CATEGORY_CREATED",
      "category",
      result.rows[0].id,
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  }),
);

router.patch(
  "/categories/:id",
  authorize("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const categoryId = id.parse(req.params.id);
    const body = categoryBody.parse(req.body);
    const result = await query(
      `UPDATE categories SET name=$1,slug=$2,description=$3,is_active=$4
       WHERE id=$5 RETURNING *`,
      [
        body.name,
        body.slug,
        body.description || null,
        body.isActive,
        categoryId,
      ],
    );
    if (!result.rows[0]) throw new AppError(404, "Categoría no encontrada");
    await audit(req.user!.id, "CATEGORY_UPDATED", "category", categoryId, {
      isActive: body.isActive,
    });
    res.json({ success: true, data: result.rows[0] });
  }),
);

const resourceBody = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1000).nullable().optional(),
  resourceType: z.enum(["LINK", "PDF", "VIDEO", "FILE"]),
  url: httpUrl(3000),
  isPublished: z.boolean().default(true),
});

router.get(
  "/courses/:courseId/resources",
  asyncHandler(async (req, res) => {
    const courseId = id.parse(req.params.courseId);
    const result = await query(
      `SELECT id,course_id,title,description,resource_type,url,is_published,created_at
       FROM course_resources WHERE course_id=$1 ORDER BY created_at DESC`,
      [courseId],
    );
    res.json({ success: true, data: result.rows });
  }),
);

router.post(
  "/courses/:courseId/resources",
  asyncHandler(async (req, res) => {
    const courseId = id.parse(req.params.courseId);
    const body = resourceBody.parse(req.body);
    const course = await query("SELECT id FROM courses WHERE id=$1", [courseId]);
    if (!course.rows[0]) throw new AppError(404, "Curso no encontrado");
    const result = await query<{ id: string }>(
      `INSERT INTO course_resources(
        course_id,title,description,resource_type,url,is_published,created_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        courseId,
        body.title,
        body.description || null,
        body.resourceType,
        body.url,
        body.isPublished,
        req.user!.id,
      ],
    );
    await audit(
      req.user!.id,
      "COURSE_RESOURCE_CREATED",
      "course_resource",
      result.rows[0].id,
      { courseId },
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  }),
);

router.patch(
  "/courses/:courseId/resources/:resourceId",
  asyncHandler(async (req, res) => {
    const courseId = id.parse(req.params.courseId);
    const resourceId = id.parse(req.params.resourceId);
    const body = resourceBody.parse(req.body);
    const result = await query(
      `UPDATE course_resources SET title=$1,description=$2,resource_type=$3,
       url=$4,is_published=$5 WHERE id=$6 AND course_id=$7 RETURNING *`,
      [
        body.title,
        body.description || null,
        body.resourceType,
        body.url,
        body.isPublished,
        resourceId,
        courseId,
      ],
    );
    if (!result.rows[0]) throw new AppError(404, "Recurso no encontrado");
    await audit(
      req.user!.id,
      "COURSE_RESOURCE_UPDATED",
      "course_resource",
      resourceId,
      { courseId, isPublished: body.isPublished },
    );
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.delete(
  "/courses/:courseId/resources/:resourceId",
  asyncHandler(async (req, res) => {
    const courseId = id.parse(req.params.courseId);
    const resourceId = id.parse(req.params.resourceId);
    const result = await query(
      `UPDATE course_resources SET is_published=false
       WHERE id=$1 AND course_id=$2 RETURNING id,is_published`,
      [resourceId, courseId],
    );
    if (!result.rows[0]) throw new AppError(404, "Recurso no encontrado");
    await audit(
      req.user!.id,
      "COURSE_RESOURCE_ARCHIVED",
      "course_resource",
      resourceId,
      { courseId },
    );
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.get(
  "/payment-settings",
  authorize("SUPER_ADMIN"),
  asyncHandler(async (_req, res) => {
    const result = await query(
      `SELECT bank_name,account_holder,account_number,account_type,currency,
       instructions,qr_image_url,updated_at FROM payment_settings WHERE id=1`,
    );
    if (!result.rows[0]) {
      throw new AppError(404, "Configuración bancaria no encontrada");
    }
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.patch(
  "/payment-settings",
  authorize("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        bankName: z.string().trim().min(2).max(120),
        accountHolder: z.string().trim().min(2).max(160),
        accountNumber: z.string().trim().min(3).max(80),
        accountType: z.string().trim().max(80).nullable().optional(),
        currency: z.string().trim().min(2).max(10),
        instructions: z.string().trim().max(1200).nullable().optional(),
        qrImageUrl: z
          .string()
          .trim()
          .max(3_000_000)
          .refine(
            (value) =>
              value.startsWith("/") ||
              value.startsWith("https://") ||
              /^data:image\/(png|jpeg|webp);base64,/.test(value),
            "La imagen QR no tiene un formato válido",
          )
          .nullable()
          .optional(),
      })
      .parse(req.body);
    if (body.qrImageUrl?.startsWith("data:")) {
      validateImageDataUrl(body.qrImageUrl, 2 * 1024 * 1024);
    }
    const result = await query(
      `INSERT INTO payment_settings(
        id,bank_name,account_holder,account_number,account_type,currency,
        instructions,qr_image_url,updated_at
       ) VALUES(1,$1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT(id) DO UPDATE SET bank_name=EXCLUDED.bank_name,
        account_holder=EXCLUDED.account_holder,
        account_number=EXCLUDED.account_number,
        account_type=EXCLUDED.account_type,currency=EXCLUDED.currency,
        instructions=EXCLUDED.instructions,qr_image_url=EXCLUDED.qr_image_url,
        updated_at=NOW() RETURNING *`,
      [
        body.bankName,
        body.accountHolder,
        body.accountNumber,
        body.accountType || null,
        body.currency.toUpperCase(),
        body.instructions || null,
        body.qrImageUrl || null,
      ],
    );
    await audit(
      req.user!.id,
      "PAYMENT_SETTINGS_UPDATED",
      "payment_settings",
      "1",
    );
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.get(
  "/enrollments",
  asyncHandler(async (req, res) => {
    const search = String(req.query.search ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    if (status && !["ACTIVE", "SUSPENDED", "REVOKED"].includes(status)) {
      throw new AppError(400, "Estado de inscripción inválido");
    }
    const params = [search, status, limit, (page - 1) * limit];
    const [rows, count] = await Promise.all([
      query(
        `SELECT e.id,e.enrolled_at,e.completed_at,e.access_status,
          e.access_changed_at,e.access_reason,u.id user_id,u.name student_name,
          u.email student_email,c.id course_id,c.title course_title,
          p.status payment_status
         FROM enrollments e JOIN users u ON u.id=e.user_id
         JOIN courses c ON c.id=e.course_id
         LEFT JOIN payments p ON p.id=e.payment_id
         WHERE ($1='' OR u.name ILIKE '%'||$1||'%' OR u.email ILIKE '%'||$1||'%'
           OR c.title ILIKE '%'||$1||'%')
           AND ($2='' OR e.access_status=$2)
         ORDER BY e.enrolled_at DESC LIMIT $3 OFFSET $4`,
        params,
      ),
      query<{ total: number }>(
        `SELECT COUNT(*)::int total FROM enrollments e
         JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id
         WHERE ($1='' OR u.name ILIKE '%'||$1||'%' OR u.email ILIKE '%'||$1||'%'
           OR c.title ILIKE '%'||$1||'%')
           AND ($2='' OR e.access_status=$2)`,
        [search, status],
      ),
    ]);
    res.json({
      success: true,
      data: {
        items: rows.rows,
        pagination: { page, limit, total: count.rows[0]?.total ?? 0 },
      },
    });
  }),
);

router.patch(
  "/enrollments/:id/access",
  authorize("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const enrollmentId = id.parse(req.params.id);
    const body = z
      .object({
        status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(req.body);
    const result = await query(
      `UPDATE enrollments SET access_status=$1,access_reason=$2,
       access_changed_at=NOW() WHERE id=$3 RETURNING *`,
      [body.status, body.reason, enrollmentId],
    );
    if (!result.rows[0]) throw new AppError(404, "Inscripción no encontrada");
    await audit(
      req.user!.id,
      "ENROLLMENT_ACCESS_CHANGED",
      "enrollment",
      enrollmentId,
      { status: body.status, reason: body.reason },
    );
    res.json({ success: true, data: result.rows[0] });
  }),
);

export default router;
