// @ts-nocheck Express 5's route-param union conflicts with validated scalar route IDs.
import { Router } from "express";
import { z } from "zod";
import { query } from "../config/database";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/errors";
import { audit } from "../services/audit";
import { createRoleNotification } from "../services/notifications";
const router = Router();
const courseSchema = z.object({
  title: z.string().min(3),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().min(10),
  instructor: z.string().min(2),
  categoryId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).default("BEGINNER"),
  price: z.coerce.number().min(0).default(0),
  durationMinutes: z.coerce.number().int().min(0).default(0),
  isPublished: z.boolean().default(false),
});
router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const { rows } = await query("SELECT * FROM categories ORDER BY name");
    res.json({ success: true, data: rows });
  }),
);
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = String(req.query.search ?? "");
    const category = String(req.query.category ?? "");
    const level = String(req.query.level ?? "");
    const { rows } = await query(
      `SELECT c.*,cat.name category_name,(SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id)::int enrollment_count,COALESCE((SELECT ROUND(AVG(r.rating)::numeric,1) FROM course_reviews r WHERE r.course_id=c.id),0) rating,(SELECT COUNT(*) FROM course_reviews r WHERE r.course_id=c.id)::int review_count FROM courses c LEFT JOIN categories cat ON cat.id=c.category_id WHERE c.is_published=true AND ($1='' OR c.title ILIKE '%'||$1||'%') AND ($2='' OR cat.slug=$2) AND ($3='' OR c.level::text=$3) ORDER BY c.created_at DESC`,
      [search, category, level],
    );
    res.json({ success: true, data: rows });
  }),
);
router.get(
  "/manage",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT c.*,cat.name category_name,
       (SELECT COUNT(*) FROM modules m WHERE m.course_id=c.id)::int module_count
       FROM courses c LEFT JOIN categories cat ON cat.id=c.category_id
       ORDER BY c.updated_at DESC`,
    );
    res.json({ success: true, data: rows });
  }),
);
router.get(
  "/manage/:id",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      "SELECT c.*,cat.name category_name FROM courses c LEFT JOIN categories cat ON cat.id=c.category_id WHERE c.id::text=$1 OR c.slug=$1",
      [req.params.id],
    );
    if (!rows[0]) throw new AppError(404, "Curso no encontrado");
    const modules = await query(
      "SELECT m.*,COALESCE(json_agg(l ORDER BY l.position) FILTER(WHERE l.id IS NOT NULL),'[]') lessons FROM modules m LEFT JOIN lessons l ON l.module_id=m.id WHERE m.course_id=$1 GROUP BY m.id ORDER BY m.position",
      [(rows[0] as { id: string }).id],
    );
    res.json({ success: true, data: { ...rows[0], modules: modules.rows } });
  }),
);
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      "SELECT c.*,cat.name category_name FROM courses c LEFT JOIN categories cat ON cat.id=c.category_id WHERE (c.id::text=$1 OR c.slug=$1) AND c.is_published=true",
      [req.params.id],
    );
    if (!rows[0]) throw new AppError(404, "Curso no encontrado");
    const modules = await query(
      "SELECT m.*,COALESCE(json_agg(l ORDER BY l.position) FILTER(WHERE l.id IS NOT NULL),'[]') lessons FROM modules m LEFT JOIN lessons l ON l.module_id=m.id WHERE m.course_id=$1 GROUP BY m.id ORDER BY m.position",
      [(rows[0] as { id: string }).id],
    );
    res.json({ success: true, data: { ...rows[0], modules: modules.rows } });
  }),
);
router.post(
  "/",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const b = courseSchema.parse(req.body);
    const duplicate = await query("SELECT id FROM courses WHERE slug=$1", [
      b.slug,
    ]);
    if (duplicate.rows[0]) {
      throw new AppError(409, "Ya existe un curso con esa URL amigable");
    }
    const { rows } = await query(
      `INSERT INTO courses(title,slug,description,instructor,category_id,image_url,level,price,duration_minutes,is_published,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        b.title,
        b.slug,
        b.description,
        b.instructor,
        b.categoryId ?? null,
        b.imageUrl ?? null,
        b.level,
        b.price,
        b.durationMinutes,
        b.isPublished,
        req.user!.id,
      ],
    );
    await audit(
      req.user!.id,
      "COURSE_CREATED",
      "course",
      (rows[0] as { id: string }).id,
    );
    res.status(201).json({ success: true, data: rows[0] });
  }),
);
router.put(
  "/:id",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const b = courseSchema.partial().parse(req.body);
    const current = await query<Record<string, unknown>>(
      "SELECT * FROM courses WHERE id=$1",
      [req.params.id],
    );
    if (!current.rows[0]) throw new AppError(404, "Curso no encontrado");
    const merged = { ...current.rows[0], ...b };
    const { rows } = await query(
      `UPDATE courses SET title=$1,slug=$2,description=$3,instructor=$4,category_id=$5,image_url=$6,level=$7,price=$8,duration_minutes=$9,is_published=$10 WHERE id=$11 RETURNING *`,
      [
        merged.title,
        merged.slug,
        merged.description,
        merged.instructor,
        b.categoryId ?? merged.category_id,
        b.imageUrl ?? merged.image_url,
        merged.level,
        merged.price,
        b.durationMinutes ?? merged.duration_minutes,
        b.isPublished ?? merged.is_published,
        req.params.id,
      ],
    );
    await audit(req.user!.id, "COURSE_UPDATED", "course", req.params.id);
    res.json({ success: true, data: rows[0] });
  }),
);
router.patch(
  "/:id/publish",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const { isPublished } = z
      .object({ isPublished: z.boolean() })
      .parse(req.body);
    const { rows } = await query(
      "UPDATE courses SET is_published=$1 WHERE id=$2 RETURNING *",
      [isPublished, req.params.id],
    );
    if (!rows[0]) throw new AppError(404, "Curso no encontrado");
    await audit(
      req.user!.id,
      isPublished ? "COURSE_PUBLISHED" : "COURSE_UNPUBLISHED",
      "course",
      req.params.id,
    );
    if (isPublished) {
      await createRoleNotification(
        ["STUDENT"],
        "Nuevo curso disponible",
        `Ya puedes explorar “${String((rows[0] as { title: string }).title)}” en el catálogo.`,
        { type: "SUCCESS", href: "/student/courses" },
      ).catch(() => undefined);
    }
    res.json({ success: true, data: rows[0] });
  }),
);
router.post(
  "/:id/modules",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const b = z
      .object({
        title: z.string().min(2),
        position: z.number().int().positive(),
      })
      .parse(req.body);
    const { rows } = await query(
      "INSERT INTO modules(course_id,title,position) VALUES($1,$2,$3) RETURNING *",
      [req.params.id, b.title, b.position],
    );
    res.status(201).json({ success: true, data: rows[0] });
  }),
);
router.put(
  "/:courseId/modules/:moduleId",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const b = z
      .object({
        title: z.string().trim().min(2),
        position: z.coerce.number().int().positive(),
      })
      .parse(req.body);
    const { rows } = await query(
      "UPDATE modules SET title=$1,position=$2 WHERE id=$3 AND course_id=$4 RETURNING *",
      [b.title, b.position, req.params.moduleId, req.params.courseId],
    );
    if (!rows[0]) throw new AppError(404, "Módulo no encontrado");
    await audit(
      req.user!.id,
      "MODULE_UPDATED",
      "module",
      String(req.params.moduleId),
    );
    res.json({ success: true, data: rows[0] });
  }),
);
router.delete(
  "/:courseId/modules/:moduleId",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      "DELETE FROM modules WHERE id=$1 AND course_id=$2 RETURNING id",
      [req.params.moduleId, req.params.courseId],
    );
    if (!rows[0]) throw new AppError(404, "Módulo no encontrado");
    await audit(
      req.user!.id,
      "MODULE_DELETED",
      "module",
      String(req.params.moduleId),
    );
    res.json({ success: true, data: { id: rows[0].id } });
  }),
);
router.put(
  "/:courseId/lessons/:lessonId",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const b = z
      .object({
        title: z.string().trim().min(2),
        content: z.string(),
        videoUrl: z.string().url().nullable().optional(),
        durationMinutes: z.coerce.number().int().min(0),
        position: z.coerce.number().int().positive(),
        isPreview: z.boolean().default(false),
      })
      .parse(req.body);
    const { rows } = await query(
      `UPDATE lessons l SET title=$1,content=$2,video_url=$3,duration_minutes=$4,position=$5,is_preview=$6 FROM modules m WHERE l.id=$7 AND l.module_id=m.id AND m.course_id=$8 RETURNING l.*`,
      [
        b.title,
        b.content,
        b.videoUrl || null,
        b.durationMinutes,
        b.position,
        b.isPreview,
        req.params.lessonId,
        req.params.courseId,
      ],
    );
    if (!rows[0]) throw new AppError(404, "Lección no encontrada");
    await audit(
      req.user!.id,
      "LESSON_UPDATED",
      "lesson",
      String(req.params.lessonId),
    );
    res.json({ success: true, data: rows[0] });
  }),
);
router.delete(
  "/:courseId/lessons/:lessonId",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `DELETE FROM lessons l USING modules m WHERE l.id=$1 AND l.module_id=m.id AND m.course_id=$2 RETURNING l.id`,
      [req.params.lessonId, req.params.courseId],
    );
    if (!rows[0]) throw new AppError(404, "Lección no encontrada");
    await audit(
      req.user!.id,
      "LESSON_DELETED",
      "lesson",
      String(req.params.lessonId),
    );
    res.json({ success: true, data: { id: rows[0].id } });
  }),
);
export default router;
