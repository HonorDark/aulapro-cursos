import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../config/database";
import { authenticate, authorize } from "../middleware/auth";
import { audit } from "../services/audit";
import { ensureCourseworkSchema } from "../services/courseworkSchema";
import {
  createRoleNotification,
  ensureNotificationsSchema,
} from "../services/notifications";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/errors";

const router = Router();
router.use(authenticate);
router.use(
  asyncHandler(async (_req, _res, next) => {
    await ensureCourseworkSchema();
    next();
  }),
);

async function notifyCourseStudents(
  courseId: string,
  title: string,
  message: string,
) {
  await ensureNotificationsSchema();
  await query(
    `INSERT INTO notifications(user_id,title,message,type,href)
     SELECT e.user_id,$1,$2,'INFO','/student/tasks'
     FROM enrollments e WHERE e.course_id=$3 AND e.access_status='ACTIVE'`,
    [title, message, courseId],
  );
}

router.get(
  "/student",
  authorize("STUDENT"),
  asyncHandler(async (req, res) => {
    const [evaluations, surveys] = await Promise.all([
      query(
        `SELECT ev.id,ev.title,ev.description,ev.type,ev.due_at event_date,
          'EVALUATION' kind,c.id course_id,c.title course_title,NULL::boolean responded
         FROM evaluations ev JOIN courses c ON c.id=ev.course_id
         JOIN enrollments e ON e.course_id=c.id
         WHERE e.user_id=$1 AND e.access_status='ACTIVE'
           AND ev.is_published=true AND ev.is_archived=false ORDER BY ev.due_at`,
        [req.user!.id],
      ),
      query(
        `SELECT s.id,s.title,s.description,'SURVEY' type,s.closes_at event_date,
          'SURVEY' kind,c.id course_id,c.title course_title,
          EXISTS(SELECT 1 FROM survey_responses sr WHERE sr.survey_id=s.id AND sr.user_id=$1) responded
         FROM surveys s JOIN courses c ON c.id=s.course_id
         JOIN enrollments e ON e.course_id=c.id
         WHERE e.user_id=$1 AND e.access_status='ACTIVE'
           AND s.is_published=true AND s.is_archived=false ORDER BY s.closes_at`,
        [req.user!.id],
      ),
    ]);
    const items = [...evaluations.rows, ...surveys.rows].sort(
      (a, b) =>
        new Date(String(a.event_date)).getTime() -
        new Date(String(b.event_date)).getTime(),
    );
    res.json({ success: true, data: items });
  }),
);

router.get(
  "/admin",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const includeArchived = String(req.query.includeArchived ?? "") === "true";
    const [evaluations, surveys] = await Promise.all([
      query(
        `SELECT ev.id,ev.title,ev.description,ev.type,ev.due_at event_date,
          'EVALUATION' kind,ev.is_published,ev.is_archived,c.id course_id,c.title course_title,
          COUNT(es.id) FILTER(WHERE es.status<>'PENDING')::int responses
         FROM evaluations ev JOIN courses c ON c.id=ev.course_id
         LEFT JOIN evaluation_submissions es ON es.evaluation_id=ev.id
         WHERE ($1::boolean OR ev.is_archived=false)
         GROUP BY ev.id,c.id ORDER BY ev.due_at`,
        [includeArchived],
      ),
      query(
        `SELECT s.id,s.title,s.description,'SURVEY' type,s.closes_at event_date,
          'SURVEY' kind,s.is_published,s.is_archived,c.id course_id,c.title course_title,
          COUNT(sr.id)::int responses
         FROM surveys s JOIN courses c ON c.id=s.course_id
         LEFT JOIN survey_responses sr ON sr.survey_id=s.id
         WHERE ($1::boolean OR s.is_archived=false)
         GROUP BY s.id,c.id ORDER BY s.closes_at`,
        [includeArchived],
      ),
    ]);
    const items = [...evaluations.rows, ...surveys.rows].sort(
      (a, b) =>
        new Date(String(a.event_date)).getTime() -
        new Date(String(b.event_date)).getTime(),
    );
    res.json({ success: true, data: items });
  }),
);

router.post(
  "/evaluations",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        courseId: z.string().uuid(),
        title: z.string().trim().min(3).max(180),
        description: z.string().trim().max(1000).optional(),
        type: z.enum(["EXAM", "PROJECT", "PRACTICE", "QUIZ"]),
        dueAt: z.coerce.date(),
        isPublished: z.boolean().default(true),
      })
      .parse(req.body);
    const result = await query<{ id: string }>(
      `INSERT INTO evaluations(course_id,title,description,type,due_at,is_published,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.courseId, body.title, body.description || null, body.type, body.dueAt, body.isPublished, req.user!.id],
    );
    if (body.isPublished) {
      await notifyCourseStudents(body.courseId, "Nueva evaluación disponible", `${body.title} ya está disponible en tu curso.`)
        .catch((error) => console.error("Evaluation notification failed", error));
    }
    await audit(req.user!.id, "EVALUATION_CREATED", "evaluation", result.rows[0].id)
      .catch((error) => console.error("Evaluation audit failed", error));
    res.status(201).json({ success: true, data: result.rows[0] });
  }),
);

router.put(
  "/evaluations/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const body = z
      .object({
        courseId: z.string().uuid(),
        title: z.string().trim().min(3).max(180),
        description: z.string().trim().max(1000).optional(),
        type: z.enum(["EXAM", "PROJECT", "PRACTICE", "QUIZ"]),
        dueAt: z.coerce.date(),
      })
      .parse(req.body);
    const current = await query<{ course_id: string; responses: number }>(
      `SELECT ev.course_id,COUNT(es.id)::int responses
       FROM evaluations ev LEFT JOIN evaluation_submissions es ON es.evaluation_id=ev.id
       WHERE ev.id=$1 AND ev.is_archived=false GROUP BY ev.id`,
      [id],
    );
    if (!current.rows[0]) throw new AppError(404, "Evaluación no encontrada");
    if (current.rows[0].responses > 0 && current.rows[0].course_id !== body.courseId) {
      throw new AppError(
        409,
        "No puedes cambiar de curso una evaluación que ya tiene entregas",
      );
    }
    const result = await query(
      `UPDATE evaluations SET course_id=$1,title=$2,description=$3,type=$4,due_at=$5
       WHERE id=$6 AND is_archived=false RETURNING *`,
      [body.courseId, body.title, body.description || null, body.type, body.dueAt, id],
    );
    await audit(req.user!.id, "EVALUATION_UPDATED", "evaluation", id)
      .catch((error) => console.error("Evaluation update audit failed", error));
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.post(
  "/surveys",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        courseId: z.string().uuid(),
        title: z.string().trim().min(3).max(180),
        description: z.string().trim().max(1000).optional(),
        closesAt: z.coerce.date(),
        isPublished: z.boolean().default(true),
        questions: z.array(z.string().trim().min(3).max(500)).min(1).max(12),
      })
      .parse(req.body);
    const client = await pool.connect();
    let surveyId = "";
    try {
      await client.query("BEGIN");
      const survey = await client.query<{ id: string }>(
        `INSERT INTO surveys(course_id,title,description,closes_at,is_published,created_by)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [body.courseId, body.title, body.description || null, body.closesAt, body.isPublished, req.user!.id],
      );
      surveyId = survey.rows[0].id;
      for (const [index, prompt] of body.questions.entries()) {
        await client.query(
          "INSERT INTO survey_questions(survey_id,prompt,position) VALUES($1,$2,$3)",
          [surveyId, prompt, index + 1],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    if (body.isPublished) {
      await notifyCourseStudents(body.courseId, "Nuevo cuestionario disponible", `${body.title} ya está disponible en tu curso.`)
        .catch((error) => console.error("Survey notification failed", error));
    }
    await audit(req.user!.id, "SURVEY_CREATED", "survey", surveyId)
      .catch((error) => console.error("Survey audit failed", error));
    res.status(201).json({ success: true, data: { id: surveyId } });
  }),
);

router.get(
  "/admin/surveys/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const result = await query(
      `SELECT s.id,s.course_id,s.title,s.description,s.closes_at,s.is_published,
        s.is_archived,c.title course_title,
        COALESCE(json_agg(json_build_object('id',q.id,'prompt',q.prompt,'position',q.position)
          ORDER BY q.position) FILTER(WHERE q.id IS NOT NULL),'[]') questions
       FROM surveys s JOIN courses c ON c.id=s.course_id
       LEFT JOIN survey_questions q ON q.survey_id=s.id
       WHERE s.id=$1 GROUP BY s.id,c.id`,
      [id],
    );
    if (!result.rows[0]) throw new AppError(404, "Cuestionario no encontrado");
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.put(
  "/surveys/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const body = z
      .object({
        courseId: z.string().uuid(),
        title: z.string().trim().min(3).max(180),
        description: z.string().trim().max(1000).optional(),
        closesAt: z.coerce.date(),
        questions: z.array(z.string().trim().min(3).max(500)).min(1).max(12),
      })
      .parse(req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<{
        course_id: string;
        responses: number;
      }>(
        `SELECT s.course_id,
           (SELECT COUNT(*) FROM survey_responses sr WHERE sr.survey_id=s.id)::int responses
         FROM surveys s WHERE s.id=$1 AND s.is_archived=false FOR UPDATE`,
        [id],
      );
      if (!current.rows[0]) throw new AppError(404, "Cuestionario no encontrado");
      const existingQuestions = await client.query<{ prompt: string }>(
        "SELECT prompt FROM survey_questions WHERE survey_id=$1 ORDER BY position",
        [id],
      );
      const questionsChanged =
        existingQuestions.rows.length !== body.questions.length ||
        existingQuestions.rows.some(
          (question, index) => question.prompt !== body.questions[index],
        );
      if (
        current.rows[0].responses > 0 &&
        (current.rows[0].course_id !== body.courseId || questionsChanged)
      ) {
        throw new AppError(
          409,
          "No puedes cambiar el curso ni las preguntas de un cuestionario respondido",
        );
      }
      const updated = await client.query(
        `UPDATE surveys SET course_id=$1,title=$2,description=$3,closes_at=$4
         WHERE id=$5 RETURNING *`,
        [body.courseId, body.title, body.description || null, body.closesAt, id],
      );
      if (questionsChanged) {
        await client.query("DELETE FROM survey_questions WHERE survey_id=$1", [id]);
        for (const [index, prompt] of body.questions.entries()) {
          await client.query(
            "INSERT INTO survey_questions(survey_id,prompt,position) VALUES($1,$2,$3)",
            [id, prompt, index + 1],
          );
        }
      }
      await client.query("COMMIT");
      await audit(req.user!.id, "SURVEY_UPDATED", "survey", id)
        .catch((error) => console.error("Survey update audit failed", error));
      res.json({ success: true, data: updated.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

router.patch(
  "/:kind/:id/archive",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const kind = z.enum(["evaluation", "survey"]).parse(req.params.kind);
    const id = z.string().uuid().parse(req.params.id);
    const { isArchived } = z.object({ isArchived: z.boolean() }).parse(req.body);
    const table = kind === "evaluation" ? "evaluations" : "surveys";
    const result = await query(
      `UPDATE ${table} SET is_archived=$1,
       is_published=CASE WHEN $1 THEN false ELSE is_published END
       WHERE id=$2 RETURNING id,is_archived,is_published`,
      [isArchived, id],
    );
    if (!result.rows[0]) throw new AppError(404, "Actividad no encontrada");
    await audit(
      req.user!.id,
      isArchived ? "ACADEMIC_ARCHIVED" : "ACADEMIC_RESTORED",
      kind,
      id,
    ).catch((error) => console.error("Academic archive audit failed", error));
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.patch(
  "/:kind/:id/publish",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const kind = z.enum(["evaluation", "survey"]).parse(req.params.kind);
    const id = z.string().uuid().parse(req.params.id);
    const { isPublished } = z.object({ isPublished: z.boolean() }).parse(req.body);
    const table = kind === "evaluation" ? "evaluations" : "surveys";
    const result = await query<{ id: string; title: string; course_id: string; is_published: boolean }>(
      `UPDATE ${table} SET is_published=$1
       WHERE id=$2 AND is_archived=false
       RETURNING id,title,course_id,is_published`,
      [isPublished, id],
    );
    if (!result.rows[0]) throw new AppError(404, "Actividad no encontrada");
    if (isPublished) {
      await notifyCourseStudents(
        result.rows[0].course_id,
        kind === "evaluation" ? "Evaluación publicada" : "Cuestionario publicado",
        `${result.rows[0].title} ya está disponible en tu curso.`,
      ).catch((error) => console.error("Academic publish notification failed", error));
    }
    await audit(req.user!.id, isPublished ? "ACADEMIC_PUBLISHED" : "ACADEMIC_UNPUBLISHED", kind, id)
      .catch((error) => console.error("Academic publish audit failed", error));
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.get(
  "/surveys/:id",
  authorize("STUDENT"),
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT s.id,s.title,s.description,s.closes_at,c.title course_title,
        COALESCE(json_agg(json_build_object('id',q.id,'prompt',q.prompt,'position',q.position)
          ORDER BY q.position) FILTER(WHERE q.id IS NOT NULL),'[]') questions
       FROM surveys s JOIN courses c ON c.id=s.course_id
       JOIN enrollments e ON e.course_id=s.course_id
       LEFT JOIN survey_questions q ON q.survey_id=s.id
       WHERE s.id=$1 AND e.user_id=$2 AND e.access_status='ACTIVE'
         AND s.is_published=true AND s.is_archived=false GROUP BY s.id,c.id`,
      [req.params.id, req.user!.id],
    );
    if (!result.rows[0]) throw new AppError(404, "Cuestionario no disponible");
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.post(
  "/surveys/:id/respond",
  authorize("STUDENT"),
  asyncHandler(async (req, res) => {
    const { answers } = z
      .object({ answers: z.record(z.string(), z.string().trim().min(1).max(1200)) })
      .parse(req.body);
    const allowed = await query<{ id: string; title: string }>(
      `SELECT q.id,s.title FROM survey_questions q JOIN surveys s ON s.id=q.survey_id
       JOIN enrollments e ON e.course_id=s.course_id
       LEFT JOIN survey_responses sr ON sr.survey_id=s.id AND sr.user_id=$2
       WHERE s.id=$1 AND e.user_id=$2 AND e.access_status='ACTIVE'
         AND s.is_published=true AND s.is_archived=false
         AND (s.closes_at>=NOW() OR sr.status='CHANGES_REQUESTED')`,
      [req.params.id, req.user!.id],
    );
    if (!allowed.rows.length) throw new AppError(403, "Cuestionario cerrado o no disponible");
    if (allowed.rows.some((row) => !answers[row.id])) throw new AppError(400, "Responde todas las preguntas");
    const result = await query(
      `INSERT INTO survey_responses(survey_id,user_id,answers,status)
       VALUES($1,$2,$3,'SUBMITTED')
       ON CONFLICT(survey_id,user_id) DO UPDATE SET answers=EXCLUDED.answers,status='SUBMITTED',
         submitted_at=NOW(),feedback=NULL,reviewed_at=NULL,reviewed_by=NULL
       RETURNING id,status,submitted_at`,
      [req.params.id, req.user!.id, JSON.stringify(answers)],
    );
    await createRoleNotification(
      ["ADMIN", "SUPER_ADMIN"],
      "Cuestionario respondido",
      `${req.user!.email} completó ${allowed.rows[0].title}.`,
      { type: "INFO", href: "/admin/submissions" },
    );
    await audit(req.user!.id, "QUESTIONNAIRE_SUBMITTED", "questionnaire", String((result.rows[0] as { id: string }).id));
    res.json({ success: true, data: result.rows[0] });
  }),
);

export default router;
