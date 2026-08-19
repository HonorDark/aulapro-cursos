import { Router } from "express";
import { z } from "zod";
import { query } from "../config/database";
import { authenticate, authorize } from "../middleware/auth";
import { audit } from "../services/audit";
import { ensureCourseworkSchema } from "../services/courseworkSchema";
import {
  createNotification,
  createRoleNotification,
  ensureNotificationsSchema,
} from "../services/notifications";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/errors";
import { validateUploadDataUrl } from "../utils/uploads";

const router = Router();
router.use(authenticate);

const activityKind = z.enum(["assignment", "evaluation", "questionnaire"]);
const idParams = z.object({ kind: activityKind, id: z.string().uuid() });
const attachmentMime = z.enum([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const submissionBody = z
  .object({
    answerText: z.string().trim().max(8000).optional().default(""),
    attachmentData: z.string().max(6_000_000).nullable().optional(),
    attachmentName: z.string().trim().max(255).nullable().optional(),
    attachmentMime: attachmentMime.nullable().optional(),
  })
  .refine((body) => Boolean(body.answerText || body.attachmentData), {
    message: "Escribe una respuesta o adjunta un archivo",
  })
  .refine(
    (body) =>
      !body.attachmentData ||
      Boolean(body.attachmentName && body.attachmentMime),
    { message: "El archivo adjunto no es válido" },
  );

router.get(
  "/student",
  authorize("STUDENT"),
  asyncHandler(async (req, res) => {
    await ensureCourseworkSchema();
    const [assignments, evaluations, questionnaires] = await Promise.all([
      query(
        `SELECT a.id,'ASSIGNMENT' kind,'TASK' type,a.title,a.description,a.due_at,
          a.max_score,c.id course_id,c.title course_title,
          COALESCE(s.status,'NOT_SUBMITTED') status,s.id submission_id,s.score,s.feedback,
          s.submitted_at,s.reviewed_at,(a.due_at<NOW()) is_overdue
         FROM assignments a
         JOIN courses c ON c.id=a.course_id
         JOIN enrollments e ON e.course_id=a.course_id AND e.user_id=$1
           AND e.access_status='ACTIVE'
         LEFT JOIN assignment_submissions s ON s.assignment_id=a.id AND s.user_id=$1
         WHERE a.is_published=true AND a.is_archived=false ORDER BY a.due_at`,
        [req.user!.id],
      ),
      query(
        `SELECT ev.id,'EVALUATION' kind,ev.type,ev.title,ev.description,ev.due_at,
          100::numeric max_score,c.id course_id,c.title course_title,
          CASE WHEN es.status IS NULL OR es.status='PENDING' THEN 'NOT_SUBMITTED' ELSE es.status END status,
          es.id submission_id,es.score,es.feedback,es.submitted_at,es.reviewed_at,
          (ev.due_at<NOW()) is_overdue
         FROM evaluations ev
         JOIN courses c ON c.id=ev.course_id
         JOIN enrollments e ON e.course_id=ev.course_id AND e.user_id=$1
           AND e.access_status='ACTIVE'
         LEFT JOIN evaluation_submissions es ON es.evaluation_id=ev.id AND es.user_id=$1
         WHERE ev.is_published=true AND ev.is_archived=false ORDER BY ev.due_at`,
        [req.user!.id],
      ),
      query(
        `SELECT s.id,'QUESTIONNAIRE' kind,'QUESTIONNAIRE' type,s.title,s.description,
          s.closes_at due_at,NULL::numeric max_score,c.id course_id,c.title course_title,
          COALESCE(sr.status,'NOT_SUBMITTED') status,sr.id submission_id,NULL::numeric score,
          sr.feedback,sr.submitted_at,sr.reviewed_at,(s.closes_at<NOW()) is_overdue
         FROM surveys s
         JOIN courses c ON c.id=s.course_id
         JOIN enrollments e ON e.course_id=s.course_id AND e.user_id=$1
           AND e.access_status='ACTIVE'
         LEFT JOIN survey_responses sr ON sr.survey_id=s.id AND sr.user_id=$1
         WHERE s.is_published=true AND s.is_archived=false ORDER BY s.closes_at`,
        [req.user!.id],
      ),
    ]);

    const items = [
      ...assignments.rows,
      ...evaluations.rows,
      ...questionnaires.rows,
    ].sort(
      (a, b) =>
        new Date(String(a.due_at)).getTime() -
        new Date(String(b.due_at)).getTime(),
    );
    res.json({ success: true, data: items });
  }),
);

router.get(
  "/student/course/:courseId",
  authorize("STUDENT"),
  asyncHandler(async (req, res) => {
    await ensureCourseworkSchema();
    const courseId = z.string().uuid().parse(req.params.courseId);
    const enrollment = await query<{ id: string; modality: string }>(
      `SELECT e.id,c.modality FROM enrollments e JOIN courses c ON c.id=e.course_id
       WHERE e.user_id=$1 AND e.course_id=$2 AND e.access_status='ACTIVE'`,
      [req.user!.id, courseId],
    );
    if (!enrollment.rows[0]) {
      throw new AppError(403, "No tienes una inscripción activa en este curso");
    }

    const [assignments, evaluations, questionnaires, resources, recent, grades] =
      await Promise.all([
        query(
          `SELECT a.id,'ASSIGNMENT' kind,'TASK' type,a.title,a.description,a.due_at,
            a.max_score,COALESCE(s.status,'NOT_SUBMITTED') status,s.score,s.feedback,
            s.submitted_at,s.reviewed_at,(a.due_at<NOW()) is_overdue
           FROM assignments a
           LEFT JOIN assignment_submissions s ON s.assignment_id=a.id AND s.user_id=$2
           WHERE a.course_id=$1 AND a.is_published=true AND a.is_archived=false
           ORDER BY a.due_at`,
          [courseId, req.user!.id],
        ),
        query(
          `SELECT ev.id,'EVALUATION' kind,ev.type,ev.title,ev.description,ev.due_at,
            100::numeric max_score,
            CASE WHEN es.status IS NULL OR es.status='PENDING' THEN 'NOT_SUBMITTED' ELSE es.status END status,
            es.score,es.feedback,es.submitted_at,es.reviewed_at,(ev.due_at<NOW()) is_overdue
           FROM evaluations ev
           LEFT JOIN evaluation_submissions es ON es.evaluation_id=ev.id AND es.user_id=$2
           WHERE ev.course_id=$1 AND ev.is_published=true AND ev.is_archived=false
           ORDER BY ev.due_at`,
          [courseId, req.user!.id],
        ),
        query(
          `SELECT s.id,'QUESTIONNAIRE' kind,'QUESTIONNAIRE' type,s.title,s.description,
            s.closes_at due_at,NULL::numeric max_score,COALESCE(sr.status,'NOT_SUBMITTED') status,
            NULL::numeric score,sr.feedback,sr.submitted_at,sr.reviewed_at,
            (s.closes_at<NOW()) is_overdue
           FROM surveys s
           LEFT JOIN survey_responses sr ON sr.survey_id=s.id AND sr.user_id=$2
           WHERE s.course_id=$1 AND s.is_published=true AND s.is_archived=false
           ORDER BY s.closes_at`,
          [courseId, req.user!.id],
        ),
        query(
          `SELECT id,title,description,resource_type,url,created_at
           FROM course_resources WHERE course_id=$1 AND is_published=true
           ORDER BY created_at,title`,
          [courseId],
        ),
        query(
          `SELECT * FROM (
             SELECT lp.id::text,'LESSON' kind,'COMPLETED' status,l.title,
               m.title detail,lp.completed_at happened_at
             FROM lesson_progress lp JOIN lessons l ON l.id=lp.lesson_id
             JOIN modules m ON m.id=l.module_id
             WHERE lp.enrollment_id=$1 AND lp.completed=true
             UNION ALL
             SELECT s.id::text,'ASSIGNMENT' kind,s.status,a.title,
               CASE WHEN s.status='GRADED' THEN 'Tarea calificada' WHEN s.status='CHANGES_REQUESTED'
                 THEN 'Requiere cambios' ELSE 'Tarea enviada' END detail,
               COALESCE(s.reviewed_at,s.submitted_at) happened_at
             FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id
             WHERE s.user_id=$2 AND a.course_id=$3 AND a.is_archived=false
             UNION ALL
             SELECT s.id::text,'EVALUATION' kind,s.status,ev.title,
               CASE WHEN s.status='GRADED' THEN 'Evaluación calificada' WHEN s.status='CHANGES_REQUESTED'
                 THEN 'Requiere cambios' ELSE 'Evaluación enviada' END detail,
               COALESCE(s.reviewed_at,s.submitted_at) happened_at
             FROM evaluation_submissions s JOIN evaluations ev ON ev.id=s.evaluation_id
             WHERE s.user_id=$2 AND ev.course_id=$3 AND ev.is_archived=false
               AND s.status<>'PENDING'
             UNION ALL
             SELECT sr.id::text,'QUESTIONNAIRE' kind,sr.status,s.title,
               CASE WHEN sr.status='VERIFIED' THEN 'Cuestionario verificado' WHEN sr.status='CHANGES_REQUESTED'
                 THEN 'Requiere cambios' ELSE 'Cuestionario enviado' END detail,
               COALESCE(sr.reviewed_at,sr.submitted_at) happened_at
             FROM survey_responses sr JOIN surveys s ON s.id=sr.survey_id
             WHERE sr.user_id=$2 AND s.course_id=$3 AND s.is_archived=false
           ) history WHERE happened_at IS NOT NULL ORDER BY happened_at DESC LIMIT 10`,
          [enrollment.rows[0].id, req.user!.id, courseId],
        ),
        query(
          `SELECT * FROM (
             SELECT s.id::text,'ASSIGNMENT' kind,a.title,s.score,a.max_score,
               s.feedback,s.reviewed_at
             FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id
             WHERE s.user_id=$1 AND a.course_id=$2 AND a.is_archived=false
               AND s.status='GRADED'
             UNION ALL
             SELECT s.id::text,'EVALUATION' kind,ev.title,s.score,100::numeric max_score,
               s.feedback,s.reviewed_at
             FROM evaluation_submissions s JOIN evaluations ev ON ev.id=s.evaluation_id
             WHERE s.user_id=$1 AND ev.course_id=$2 AND ev.is_archived=false
               AND s.status='GRADED'
           ) results ORDER BY reviewed_at DESC NULLS LAST`,
          [req.user!.id, courseId],
        ),
      ]);

    const activities = [
      ...assignments.rows,
      ...evaluations.rows,
      ...questionnaires.rows,
    ].sort(
      (a, b) =>
        new Date(String(a.due_at)).getTime() -
        new Date(String(b.due_at)).getTime(),
    );
    res.json({
      success: true,
      data: {
        modality: enrollment.rows[0].modality,
        activities,
        resources: resources.rows,
        recent: recent.rows,
        grades: grades.rows,
      },
    });
  }),
);

router.get(
  "/student/:kind/:id",
  authorize("STUDENT"),
  asyncHandler(async (req, res) => {
    await ensureCourseworkSchema();
    const { kind, id } = idParams.parse(req.params);
    let result;

    if (kind === "assignment") {
      result = await query(
        `SELECT a.id,'ASSIGNMENT' kind,'TASK' type,a.title,a.description,a.due_at,a.max_score,
          c.title course_title,(a.due_at<NOW()) is_overdue,s.id submission_id,COALESCE(s.status,'NOT_SUBMITTED') status,
          s.answer_text,s.attachment_name,s.attachment_mime,s.score,s.feedback,s.submitted_at,s.reviewed_at
         FROM assignments a JOIN courses c ON c.id=a.course_id
         JOIN enrollments e ON e.course_id=a.course_id AND e.user_id=$2
           AND e.access_status='ACTIVE'
         LEFT JOIN assignment_submissions s ON s.assignment_id=a.id AND s.user_id=$2
         WHERE a.id=$1 AND a.is_published=true AND a.is_archived=false`,
        [id, req.user!.id],
      );
    } else if (kind === "evaluation") {
      result = await query(
        `SELECT ev.id,'EVALUATION' kind,ev.type,ev.title,ev.description,ev.due_at,100::numeric max_score,
          c.title course_title,(ev.due_at<NOW()) is_overdue,es.id submission_id,
          CASE WHEN es.status IS NULL OR es.status='PENDING' THEN 'NOT_SUBMITTED' ELSE es.status END status,
          es.answer_text,es.attachment_name,es.attachment_mime,es.score,es.feedback,es.submitted_at,es.reviewed_at
         FROM evaluations ev JOIN courses c ON c.id=ev.course_id
         JOIN enrollments e ON e.course_id=ev.course_id AND e.user_id=$2
           AND e.access_status='ACTIVE'
         LEFT JOIN evaluation_submissions es ON es.evaluation_id=ev.id AND es.user_id=$2
         WHERE ev.id=$1 AND ev.is_published=true AND ev.is_archived=false`,
        [id, req.user!.id],
      );
    } else {
      result = await query(
        `SELECT s.id,'QUESTIONNAIRE' kind,'QUESTIONNAIRE' type,s.title,s.description,s.closes_at due_at,
          c.title course_title,(s.closes_at<NOW()) is_overdue,sr.id submission_id,COALESCE(sr.status,'NOT_SUBMITTED') status,
          sr.answers,sr.feedback,sr.submitted_at,sr.reviewed_at,
          COALESCE(json_agg(json_build_object('id',q.id,'prompt',q.prompt,'position',q.position)
            ORDER BY q.position) FILTER(WHERE q.id IS NOT NULL),'[]') questions
         FROM surveys s JOIN courses c ON c.id=s.course_id
         JOIN enrollments e ON e.course_id=s.course_id AND e.user_id=$2
           AND e.access_status='ACTIVE'
         LEFT JOIN survey_questions q ON q.survey_id=s.id
         LEFT JOIN survey_responses sr ON sr.survey_id=s.id AND sr.user_id=$2
         WHERE s.id=$1 AND s.is_published=true AND s.is_archived=false
         GROUP BY s.id,c.id,sr.id`,
        [id, req.user!.id],
      );
    }

    if (!result.rows[0]) throw new AppError(404, "Actividad no disponible");
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.post(
  "/student/:kind/:id/submit",
  authorize("STUDENT"),
  asyncHandler(async (req, res) => {
    await ensureCourseworkSchema();
    const { kind, id } = idParams.parse(req.params);
    if (kind === "questionnaire") {
      throw new AppError(400, "Utiliza el envío de cuestionario");
    }
    const body = submissionBody.parse(req.body);
    if (body.attachmentData && body.attachmentMime) {
      validateUploadDataUrl(
        body.attachmentData,
        body.attachmentMime,
        5 * 1024 * 1024,
      );
    }
    const table = kind === "assignment" ? "assignments" : "evaluations";
    const submissionTable =
      kind === "assignment"
        ? "assignment_submissions"
        : "evaluation_submissions";
    const foreignKey =
      kind === "assignment" ? "assignment_id" : "evaluation_id";
    const availability = await query<{
      title: string;
      status: string | null;
    }>(
      `SELECT a.title,sub.status FROM ${table} a
       JOIN enrollments e ON e.course_id=a.course_id AND e.user_id=$2
         AND e.access_status='ACTIVE'
       LEFT JOIN ${submissionTable} sub ON sub.${foreignKey}=a.id AND sub.user_id=$2
       WHERE a.id=$1 AND a.is_published=true AND a.is_archived=false
         AND (a.${kind === "assignment" ? "due_at" : "due_at"}>=NOW() OR sub.status='CHANGES_REQUESTED')`,
      [id, req.user!.id],
    );
    if (!availability.rows[0]) {
      throw new AppError(403, "La actividad venció o no está disponible");
    }
    if (availability.rows[0].status === "GRADED") {
      throw new AppError(409, "La entrega ya fue calificada");
    }

    const result = await query(
      `INSERT INTO ${submissionTable}(${foreignKey},user_id,answer_text,attachment_data,attachment_name,attachment_mime,status,submitted_at,feedback,score,reviewed_at,reviewed_by)
       VALUES($1,$2,$3,$4,$5,$6,'SUBMITTED',NOW(),NULL,NULL,NULL,NULL)
       ON CONFLICT(${foreignKey},user_id) DO UPDATE SET
         answer_text=EXCLUDED.answer_text,attachment_data=EXCLUDED.attachment_data,
         attachment_name=EXCLUDED.attachment_name,attachment_mime=EXCLUDED.attachment_mime,
         status='SUBMITTED',submitted_at=NOW(),feedback=NULL,score=NULL,reviewed_at=NULL,reviewed_by=NULL
       RETURNING id,status,submitted_at`,
      [
        id,
        req.user!.id,
        body.answerText || null,
        body.attachmentData ?? null,
        body.attachmentName ?? null,
        body.attachmentMime ?? null,
      ],
    );
    await createRoleNotification(
      ["ADMIN", "SUPER_ADMIN"],
      "Nueva entrega por revisar",
      `${req.user!.email} envió ${availability.rows[0].title}.`,
      { type: "INFO", href: "/admin/submissions" },
    );
    await audit(
      req.user!.id,
      "COURSEWORK_SUBMITTED",
      kind,
      String((result.rows[0] as { id: string }).id),
      { activityId: id },
    );
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.post(
  "/student/questionnaire/:id/submit",
  authorize("STUDENT"),
  asyncHandler(async (req, res) => {
    await ensureCourseworkSchema();
    const id = z.string().uuid().parse(req.params.id);
    const { answers } = z
      .object({
        answers: z.record(z.string(), z.string().trim().min(1).max(1200)),
      })
      .parse(req.body);
    const allowed = await query<{ id: string; title: string }>(
      `SELECT q.id,s.title FROM survey_questions q JOIN surveys s ON s.id=q.survey_id
       JOIN enrollments e ON e.course_id=s.course_id AND e.user_id=$2
         AND e.access_status='ACTIVE'
       LEFT JOIN survey_responses sr ON sr.survey_id=s.id AND sr.user_id=$2
       WHERE s.id=$1 AND s.is_published=true AND s.is_archived=false
         AND (s.closes_at>=NOW() OR sr.status='CHANGES_REQUESTED')`,
      [id, req.user!.id],
    );
    if (!allowed.rows.length) {
      throw new AppError(403, "El cuestionario venció o no está disponible");
    }
    if (allowed.rows.some((question) => !answers[question.id])) {
      throw new AppError(400, "Responde todas las preguntas");
    }
    const result = await query(
      `INSERT INTO survey_responses(survey_id,user_id,answers,status,submitted_at,feedback,reviewed_at,reviewed_by)
       VALUES($1,$2,$3,'SUBMITTED',NOW(),NULL,NULL,NULL)
       ON CONFLICT(survey_id,user_id) DO UPDATE SET answers=EXCLUDED.answers,status='SUBMITTED',
         submitted_at=NOW(),feedback=NULL,reviewed_at=NULL,reviewed_by=NULL
       RETURNING id,status,submitted_at`,
      [id, req.user!.id, JSON.stringify(answers)],
    );
    await createRoleNotification(
      ["ADMIN", "SUPER_ADMIN"],
      "Cuestionario respondido",
      `${req.user!.email} completó ${allowed.rows[0].title}.`,
      { type: "INFO", href: "/admin/submissions" },
    );
    await audit(
      req.user!.id,
      "QUESTIONNAIRE_SUBMITTED",
      "questionnaire",
      String((result.rows[0] as { id: string }).id),
      { activityId: id },
    );
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.post(
  "/admin/assignments",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    await Promise.all([ensureCourseworkSchema(), ensureNotificationsSchema()]);
    const body = z
      .object({
        courseId: z.string().uuid(),
        title: z.string().trim().min(3).max(180),
        description: z.string().trim().max(3000).optional(),
        dueAt: z.coerce.date(),
        maxScore: z.coerce.number().positive().max(1000).default(100),
        isPublished: z.boolean().default(true),
      })
      .parse(req.body);
    const result = await query<{ id: string }>(
      `INSERT INTO assignments(course_id,title,description,due_at,max_score,is_published,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        body.courseId,
        body.title,
        body.description || null,
        body.dueAt,
        body.maxScore,
        body.isPublished,
        req.user!.id,
      ],
    );
    if (body.isPublished) {
      await query(
        `INSERT INTO notifications(user_id,title,message,type,href)
         SELECT e.user_id,'Nueva tarea disponible',$1,'INFO','/student/tasks'
         FROM enrollments e WHERE e.course_id=$2 AND e.access_status='ACTIVE'`,
        [`${body.title} ya está disponible en tu curso.`, body.courseId],
      ).catch((error) => console.error("Assignment notification failed", error));
    }
    await audit(
      req.user!.id,
      "ASSIGNMENT_CREATED",
      "assignment",
      result.rows[0].id,
    ).catch((error) => console.error("Assignment audit failed", error));
    res.status(201).json({ success: true, data: result.rows[0] });
  }),
);

router.put(
  "/admin/assignments/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const body = z
      .object({
        courseId: z.string().uuid(),
        title: z.string().trim().min(3).max(180),
        description: z.string().trim().max(3000).optional(),
        dueAt: z.coerce.date(),
        maxScore: z.coerce.number().positive().max(1000),
      })
      .parse(req.body);
    const current = await query<{ course_id: string; responses: number }>(
      `SELECT a.course_id,COUNT(s.id)::int responses
       FROM assignments a LEFT JOIN assignment_submissions s ON s.assignment_id=a.id
       WHERE a.id=$1 AND a.is_archived=false GROUP BY a.id`,
      [id],
    );
    if (!current.rows[0]) throw new AppError(404, "Tarea no encontrada");
    if (current.rows[0].responses > 0 && current.rows[0].course_id !== body.courseId) {
      throw new AppError(409, "No puedes cambiar de curso una tarea que ya tiene entregas");
    }
    const result = await query(
      `UPDATE assignments SET course_id=$1,title=$2,description=$3,due_at=$4,max_score=$5
       WHERE id=$6 AND is_archived=false RETURNING *`,
      [body.courseId, body.title, body.description || null, body.dueAt, body.maxScore, id],
    );
    await audit(req.user!.id, "ASSIGNMENT_UPDATED", "assignment", id)
      .catch((error) => console.error("Assignment update audit failed", error));
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.get(
  "/admin/assignments",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    await ensureCourseworkSchema();
    const includeArchived = String(req.query.includeArchived ?? "") === "true";
    const result = await query(
      `SELECT a.id,a.title,a.description,'TASK' type,a.due_at event_date,'ASSIGNMENT' kind,
        a.is_published,a.is_archived,c.id course_id,c.title course_title,
        COUNT(s.id)::int responses,a.max_score
       FROM assignments a JOIN courses c ON c.id=a.course_id
       LEFT JOIN assignment_submissions s ON s.assignment_id=a.id
       WHERE ($1::boolean OR a.is_archived=false)
       GROUP BY a.id,c.id ORDER BY a.due_at`,
      [includeArchived],
    );
    res.json({ success: true, data: result.rows });
  }),
);

router.patch(
  "/admin/assignments/:id/publish",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    await ensureCourseworkSchema();
    const id = z.string().uuid().parse(req.params.id);
    const { isPublished } = z
      .object({ isPublished: z.boolean() })
      .parse(req.body);
    const result = await query(
      `UPDATE assignments SET is_published=$1
       WHERE id=$2 AND is_archived=false RETURNING id,is_published`,
      [isPublished, id],
    );
    if (!result.rows[0]) throw new AppError(404, "Tarea no encontrada");
    await audit(
      req.user!.id,
      isPublished ? "ASSIGNMENT_PUBLISHED" : "ASSIGNMENT_UNPUBLISHED",
      "assignment",
      id,
    ).catch((error) => console.error("Assignment publish audit failed", error));
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.patch(
  "/admin/assignments/:id/archive",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { isArchived } = z.object({ isArchived: z.boolean() }).parse(req.body);
    const result = await query(
      `UPDATE assignments SET is_archived=$1,
       is_published=CASE WHEN $1 THEN false ELSE is_published END
       WHERE id=$2 RETURNING id,is_archived,is_published`,
      [isArchived, id],
    );
    if (!result.rows[0]) throw new AppError(404, "Tarea no encontrada");
    await audit(
      req.user!.id,
      isArchived ? "ASSIGNMENT_ARCHIVED" : "ASSIGNMENT_RESTORED",
      "assignment",
      id,
    ).catch((error) => console.error("Assignment archive audit failed", error));
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.get(
  "/admin/submissions",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (_req, res) => {
    await ensureCourseworkSchema();
    const [assignments, evaluations, questionnaires] = await Promise.all([
      query(
        `SELECT s.id,'ASSIGNMENT' kind,s.status,s.score,s.submitted_at,s.reviewed_at,
          a.title activity_title,a.max_score,c.id course_id,c.title course_title,
          u.id student_id,u.name student_name,u.email student_email,
          (s.attachment_data IS NOT NULL) has_attachment,s.answer_text IS NOT NULL has_answer
         FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id
         JOIN courses c ON c.id=a.course_id JOIN users u ON u.id=s.user_id
         ORDER BY s.submitted_at DESC`,
      ),
      query(
        `SELECT s.id,'EVALUATION' kind,s.status,s.score,s.submitted_at,s.reviewed_at,
          ev.title activity_title,100::numeric max_score,c.id course_id,c.title course_title,
          u.id student_id,u.name student_name,u.email student_email,
          (s.attachment_data IS NOT NULL) has_attachment,s.answer_text IS NOT NULL has_answer
         FROM evaluation_submissions s JOIN evaluations ev ON ev.id=s.evaluation_id
         JOIN courses c ON c.id=ev.course_id JOIN users u ON u.id=s.user_id
         WHERE s.status<>'PENDING' ORDER BY s.submitted_at DESC`,
      ),
      query(
        `SELECT sr.id,'QUESTIONNAIRE' kind,sr.status,NULL::numeric score,sr.submitted_at,sr.reviewed_at,
          s.title activity_title,NULL::numeric max_score,c.id course_id,c.title course_title,
          u.id student_id,u.name student_name,u.email student_email,
          false has_attachment,true has_answer
         FROM survey_responses sr JOIN surveys s ON s.id=sr.survey_id
         JOIN courses c ON c.id=s.course_id JOIN users u ON u.id=sr.user_id
         ORDER BY sr.submitted_at DESC`,
      ),
    ]);
    const items = [
      ...assignments.rows,
      ...evaluations.rows,
      ...questionnaires.rows,
    ].sort(
      (a, b) =>
        new Date(String(b.submitted_at)).getTime() -
        new Date(String(a.submitted_at)).getTime(),
    );
    res.json({ success: true, data: items });
  }),
);

router.get(
  "/admin/submissions/:kind/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    await ensureCourseworkSchema();
    const { kind, id } = idParams.parse(req.params);
    let result;
    if (kind === "assignment") {
      result = await query(
        `SELECT sub.*,a.title activity_title,a.description,a.max_score,c.title course_title,
          u.name student_name,u.email student_email
         FROM assignment_submissions sub JOIN assignments a ON a.id=sub.assignment_id
         JOIN courses c ON c.id=a.course_id JOIN users u ON u.id=sub.user_id WHERE sub.id=$1`,
        [id],
      );
    } else if (kind === "evaluation") {
      result = await query(
        `SELECT sub.*,ev.title activity_title,ev.description,ev.type,100::numeric max_score,
          c.title course_title,u.name student_name,u.email student_email
         FROM evaluation_submissions sub JOIN evaluations ev ON ev.id=sub.evaluation_id
         JOIN courses c ON c.id=ev.course_id JOIN users u ON u.id=sub.user_id WHERE sub.id=$1`,
        [id],
      );
    } else {
      result = await query(
        `SELECT sr.*,s.title activity_title,s.description,c.title course_title,
          u.name student_name,u.email student_email,
          COALESCE(json_agg(json_build_object('id',q.id,'prompt',q.prompt,'position',q.position)
            ORDER BY q.position) FILTER(WHERE q.id IS NOT NULL),'[]') questions
         FROM survey_responses sr JOIN surveys s ON s.id=sr.survey_id
         JOIN courses c ON c.id=s.course_id JOIN users u ON u.id=sr.user_id
         LEFT JOIN survey_questions q ON q.survey_id=s.id WHERE sr.id=$1
         GROUP BY sr.id,s.id,c.id,u.id`,
        [id],
      );
    }
    if (!result.rows[0]) throw new AppError(404, "Entrega no encontrada");
    res.json({ success: true, data: result.rows[0] });
  }),
);

router.patch(
  "/admin/submissions/:kind/:id/review",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    await ensureCourseworkSchema();
    const { kind, id } = idParams.parse(req.params);
    const body = z
      .object({
        decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
        score: z.coerce.number().min(0).max(1000).nullable().optional(),
        feedback: z.string().trim().min(3).max(2000),
      })
      .parse(req.body);
    if (kind !== "questionnaire" && body.decision === "APPROVED" && body.score == null) {
      throw new AppError(400, "Ingresa la calificación antes de aprobar");
    }
    const table =
      kind === "assignment"
        ? "assignment_submissions"
        : kind === "evaluation"
          ? "evaluation_submissions"
          : "survey_responses";
    const approvedStatus = kind === "questionnaire" ? "VERIFIED" : "GRADED";
    const status =
      body.decision === "APPROVED" ? approvedStatus : "CHANGES_REQUESTED";
    const result =
      kind === "questionnaire"
        ? await query<{ id: string; user_id: string; score: string | null }>(
            `UPDATE survey_responses SET status=$1,feedback=$2,reviewed_at=NOW(),reviewed_by=$3
             WHERE id=$4 RETURNING id,user_id,NULL::numeric score`,
            [status, body.feedback, req.user!.id, id],
          )
        : await query<{ id: string; user_id: string; score: string | null }>(
            `UPDATE ${table} SET status=$1,score=$2,feedback=$3,reviewed_at=NOW(),reviewed_by=$4
             WHERE id=$5 RETURNING id,user_id,score`,
            [status, body.score ?? null, body.feedback, req.user!.id, id],
          );
    if (!result.rows[0]) throw new AppError(404, "Entrega no encontrada");
    await createNotification(
      result.rows[0].user_id,
      body.decision === "APPROVED"
        ? kind === "questionnaire"
          ? "Cuestionario verificado"
          : "Entrega calificada"
        : "Tu entrega requiere cambios",
      body.feedback,
      {
        type: body.decision === "APPROVED" ? "SUCCESS" : "WARNING",
        href: "/student/tasks",
      },
    );
    await audit(req.user!.id, "COURSEWORK_REVIEWED", kind, id, {
      decision: body.decision,
      score: body.score,
    });
    res.json({ success: true, data: { ...result.rows[0], status } });
  }),
);

export default router;
