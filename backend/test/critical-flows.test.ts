import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { pool } from "../src/config/database";
import { env } from "../src/config/env";
import type { Role } from "../src/types";

type TestUser = {
  id: string;
  role: Role;
  token_version: number;
};

let server: ReturnType<typeof app.listen>;
let baseUrl = "";

const responseJson = async <T>(response: Response) => {
  const body = (await response.json()) as T;
  return { response, body };
};

const tokenFor = (user: TestUser) =>
  jwt.sign({ ver: user.token_version }, env.jwtSecret, {
    algorithm: "HS256",
    subject: user.id,
    expiresIn: "5m",
  });

const activeUser = async (role: Role) => {
  const { rows } = await pool.query<TestUser>(
    `SELECT id,role,token_version FROM users
     WHERE role=$1 AND is_active=true ORDER BY created_at LIMIT 1`,
    [role],
  );
  assert.ok(rows[0], `La base de pruebas necesita un usuario ${role} activo`);
  return rows[0];
};

before(async () => {
  await pool.query("SELECT 1");
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  await pool.end();
});

test("health readiness comprueba la conexión con PostgreSQL", async () => {
  const { response, body } = await responseJson<{
    success: boolean;
    data: { status: string; database: string };
  }>(await fetch(`${baseUrl}/api/health/ready`));

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, "ready");
  assert.equal(body.data.database, "up");
});

test("las tres cuentas demo inician sesión con bcrypt y reciben su sesión", async () => {
  const cases: Array<{
    email: string;
    password: string;
    role: Role;
    dashboard: string;
  }> = [
    {
      email: "student@aulapro.test",
      password: "Estudiante123!",
      role: "STUDENT",
      dashboard: "/api/student/dashboard",
    },
    {
      email: "admin@aulapro.test",
      password: "Admin123!",
      role: "ADMIN",
      dashboard: "/api/admin/dashboard",
    },
    {
      email: "superadmin@aulapro.test",
      password: "SuperAdmin123!",
      role: "SUPER_ADMIN",
      dashboard: "/api/admin/super-dashboard",
    },
  ];

  for (const account of cases) {
    const login = await responseJson<{
      success: boolean;
      data: { token: string; user: { role: Role } };
    }>(
      await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: account.email,
          password: account.password,
        }),
      }),
    );
    assert.equal(login.response.status, 200);
    assert.equal(login.body.data.user.role, account.role);
    assert.ok(login.body.data.token);

    const headers = { Authorization: `Bearer ${login.body.data.token}` };
    const [session, dashboard] = await Promise.all([
      fetch(`${baseUrl}/api/auth/me`, { headers }),
      fetch(`${baseUrl}${account.dashboard}`, { headers }),
    ]);
    assert.equal(session.status, 200);
    assert.equal(dashboard.status, 200);
  }
});

test("el detalle público no expone contenido ni video de lecciones privadas", async () => {
  const fixture = await pool.query<{ id: string }>(
    `SELECT DISTINCT c.id
     FROM courses c JOIN modules m ON m.course_id=c.id
     JOIN lessons l ON l.module_id=m.id
     WHERE c.is_published=true AND l.is_preview=false
       AND (NULLIF(l.content,'') IS NOT NULL OR l.video_url IS NOT NULL)
     ORDER BY c.id LIMIT 1`,
  );
  assert.ok(
    fixture.rows[0],
    "La base de pruebas necesita un curso publicado con una lección privada",
  );

  const { response, body } = await responseJson<{
    success: boolean;
    data: {
      created_by?: string;
      modules: Array<{
        lessons: Array<{
          is_preview: boolean;
          content: string | null;
          video_url: string | null;
        }>;
      }>;
    };
  }>(await fetch(`${baseUrl}/api/courses/${fixture.rows[0].id}`));

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.created_by, undefined);
  const privateLessons = body.data.modules
    .flatMap((module) => module.lessons)
    .filter((lesson) => !lesson.is_preview);
  assert.ok(privateLessons.length > 0);
  for (const lesson of privateLessons) {
    assert.equal(lesson.content, null);
    assert.equal(lesson.video_url, null);
  }
});

test("un estudiante no puede autoinscribirse a un curso pago sin pago aprobado", async () => {
  const fixture = await pool.query<{
    user_id: string;
    role: Role;
    token_version: number;
    course_id: string;
  }>(
    `SELECT u.id user_id,u.role,u.token_version,c.id course_id
     FROM users u CROSS JOIN courses c
     WHERE u.role='STUDENT' AND u.is_active=true
       AND c.is_published=true AND c.price>0
       AND NOT EXISTS(
         SELECT 1 FROM payments p
         WHERE p.user_id=u.id AND p.course_id=c.id AND p.status='APPROVED'
       )
     ORDER BY u.created_at,c.created_at LIMIT 1`,
  );
  assert.ok(
    fixture.rows[0],
    "La base de pruebas necesita un estudiante y un curso pago sin pago aprobado",
  );
  const row = fixture.rows[0];
  const beforeEnrollment = await pool.query(
    `SELECT id,payment_id,access_status,access_changed_at,access_reason
     FROM enrollments WHERE user_id=$1 AND course_id=$2`,
    [row.user_id, row.course_id],
  );

  const { response, body } = await responseJson<{
    success: boolean;
    message: string;
  }>(
    await fetch(`${baseUrl}/api/enrollments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenFor({
          id: row.user_id,
          role: row.role,
          token_version: row.token_version,
        })}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ courseId: row.course_id }),
    }),
  );

  assert.equal(response.status, 402);
  assert.equal(body.success, false);
  assert.match(body.message, /pago aprobado/i);
  const afterEnrollment = await pool.query(
    `SELECT id,payment_id,access_status,access_changed_at,access_reason
     FROM enrollments WHERE user_id=$1 AND course_id=$2`,
    [row.user_id, row.course_id],
  );
  assert.deepEqual(afterEnrollment.rows, beforeEnrollment.rows);
});

test("una inscripción suspendida o revocada no se reactiva y coursework queda bloqueado", async () => {
  const fixture = await pool.query<{
    id: string;
    user_id: string;
    course_id: string;
    role: Role;
    token_version: number;
    payment_id: string | null;
    access_status: "ACTIVE" | "SUSPENDED" | "REVOKED";
    access_changed_at: Date;
    access_reason: string | null;
  }>(
    `SELECT e.id,e.user_id,e.course_id,e.payment_id,e.access_status,
       e.access_changed_at,e.access_reason,u.role,u.token_version
     FROM enrollments e JOIN users u ON u.id=e.user_id
     JOIN courses c ON c.id=e.course_id
     WHERE u.role='STUDENT' AND u.is_active=true AND c.is_published=true
     ORDER BY e.enrolled_at LIMIT 1`,
  );
  assert.ok(
    fixture.rows[0],
    "La base de pruebas necesita una inscripción de estudiante en un curso publicado",
  );
  const original = fixture.rows[0];
  const token = tokenFor({
    id: original.user_id,
    role: original.role,
    token_version: original.token_version,
  });

  try {
    for (const status of ["SUSPENDED", "REVOKED"] as const) {
      const testReason = `Estado temporal de integración: ${status}`;
      await pool.query(
        `UPDATE enrollments SET access_status=$1,access_changed_at=NOW(),access_reason=$2
         WHERE id=$3`,
        [status, testReason, original.id],
      );

      const { response, body } = await responseJson<{
        success: boolean;
        message: string;
      }>(
        await fetch(`${baseUrl}/api/enrollments`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ courseId: original.course_id }),
        }),
      );
      assert.equal(response.status, 403);
      assert.equal(body.success, false);
      assert.match(body.message, /suspendido o revocado/i);

      const state = await pool.query<{
        access_status: string;
        access_reason: string | null;
      }>(
        "SELECT access_status,access_reason FROM enrollments WHERE id=$1",
        [original.id],
      );
      assert.equal(state.rows[0]?.access_status, status);
      assert.equal(state.rows[0]?.access_reason, testReason);

      const courseworkResponse = await fetch(
        `${baseUrl}/api/coursework/student/course/${original.course_id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      assert.equal(courseworkResponse.status, 403);
      const courseworkBody = (await courseworkResponse.json()) as {
        success: boolean;
        message: string;
      };
      assert.equal(courseworkBody.success, false);
      assert.match(courseworkBody.message, /inscripción activa/i);
    }
  } finally {
    await pool.query(
      `UPDATE enrollments SET payment_id=$1,access_status=$2,
       access_changed_at=$3,access_reason=$4 WHERE id=$5`,
      [
        original.payment_id,
        original.access_status,
        original.access_changed_at,
        original.access_reason,
        original.id,
      ],
    );
  }
});

test("archivar una tarea conserva entregas, la oculta al estudiante y respeta permisos", async () => {
  const fixture = await pool.query<{
    id: string;
    is_archived: boolean;
    is_published: boolean;
    student_id: string;
    student_role: Role;
    student_version: number;
  }>(
    `SELECT a.id,a.is_archived,a.is_published,u.id student_id,u.role student_role,
       u.token_version student_version
     FROM assignments a JOIN enrollments e ON e.course_id=a.course_id
       AND e.access_status='ACTIVE'
     JOIN users u ON u.id=e.user_id AND u.role='STUDENT' AND u.is_active=true
     WHERE a.is_archived=false AND a.is_published=true
     ORDER BY EXISTS(
       SELECT 1 FROM assignment_submissions sub WHERE sub.assignment_id=a.id
     ) DESC,a.created_at LIMIT 1`,
  );
  assert.ok(fixture.rows[0], "La base de pruebas necesita una tarea publicada");
  const activity = fixture.rows[0];
  const [admin, auditMarker, submissionsBefore] = await Promise.all([
    activeUser("ADMIN"),
    pool.query<{ id: string }>("SELECT COALESCE(MAX(id),0)::text id FROM audit_logs"),
    pool.query<{ count: number }>(
      "SELECT COUNT(*)::int count FROM assignment_submissions WHERE assignment_id=$1",
      [activity.id],
    ),
  ]);
  const studentToken = tokenFor({
    id: activity.student_id,
    role: activity.student_role,
    token_version: activity.student_version,
  });
  const adminToken = tokenFor(admin);

  try {
    const forbidden = await fetch(
      `${baseUrl}/api/coursework/admin/assignments/${activity.id}/archive`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${studentToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isArchived: true }),
      },
    );
    assert.equal(forbidden.status, 403);

    const archived = await fetch(
      `${baseUrl}/api/coursework/admin/assignments/${activity.id}/archive`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isArchived: true }),
      },
    );
    assert.equal(archived.status, 200);

    const studentList = await responseJson<{
      data: Array<{ id: string; kind: string }>;
    }>(
      await fetch(`${baseUrl}/api/coursework/student`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      }),
    );
    assert.equal(
      studentList.body.data.some(
        (item) => item.kind === "ASSIGNMENT" && item.id === activity.id,
      ),
      false,
    );
    const detail = await fetch(
      `${baseUrl}/api/coursework/student/assignment/${activity.id}`,
      { headers: { Authorization: `Bearer ${studentToken}` } },
    );
    assert.equal(detail.status, 404);

    const submissionsAfter = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::int count FROM assignment_submissions WHERE assignment_id=$1",
      [activity.id],
    );
    assert.equal(submissionsAfter.rows[0]?.count, submissionsBefore.rows[0]?.count);

    const restored = await fetch(
      `${baseUrl}/api/coursework/admin/assignments/${activity.id}/archive`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isArchived: false }),
      },
    );
    assert.equal(restored.status, 200);
  } finally {
    await pool.query(
      "UPDATE assignments SET is_archived=$1,is_published=$2 WHERE id=$3",
      [activity.is_archived, activity.is_published, activity.id],
    );
    await pool.query(
      `DELETE FROM audit_logs WHERE id>$1 AND actor_id=$2 AND entity_type='assignment'
       AND entity_id=$3 AND action IN ('ASSIGNMENT_ARCHIVED','ASSIGNMENT_RESTORED')`,
      [auditMarker.rows[0]!.id, admin.id, activity.id],
    );
  }
});

test("STUDENT no puede archivar evaluaciones ni cuestionarios", async () => {
  const [student, activities] = await Promise.all([
    activeUser("STUDENT"),
    pool.query<{ kind: "evaluation" | "survey"; id: string }>(
      `(SELECT 'evaluation' kind,id FROM evaluations WHERE is_archived=false LIMIT 1)
       UNION ALL
       (SELECT 'survey' kind,id FROM surveys WHERE is_archived=false LIMIT 1)`,
    ),
  ]);
  assert.equal(activities.rows.length, 2, "Se requieren evaluación y cuestionario");
  for (const activity of activities.rows) {
    const response = await fetch(
      `${baseUrl}/api/academic/${activity.kind}/${activity.id}/archive`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokenFor(student)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isArchived: true }),
      },
    );
    assert.equal(response.status, 403);
  }
});

test("ADMIN puede editar tareas, evaluaciones y cuestionarios sin alterar respuestas", async () => {
  const [admin, student, assignment, evaluation, survey, auditMarker] =
    await Promise.all([
      activeUser("ADMIN"),
      activeUser("STUDENT"),
      pool.query<{
        id: string;
        course_id: string;
        title: string;
        description: string | null;
        due_at: Date;
        max_score: string;
      }>("SELECT * FROM assignments WHERE is_archived=false ORDER BY created_at LIMIT 1"),
      pool.query<{
        id: string;
        course_id: string;
        title: string;
        description: string | null;
        type: string;
        due_at: Date;
      }>("SELECT * FROM evaluations WHERE is_archived=false ORDER BY created_at LIMIT 1"),
      pool.query<{
        id: string;
        course_id: string;
        title: string;
        description: string | null;
        closes_at: Date;
        questions: string[];
      }>(
        `SELECT s.id,s.course_id,s.title,s.description,s.closes_at,
         COALESCE(array_agg(q.prompt ORDER BY q.position)
           FILTER(WHERE q.id IS NOT NULL),'{}') questions
         FROM surveys s LEFT JOIN survey_questions q ON q.survey_id=s.id
         WHERE s.is_archived=false GROUP BY s.id ORDER BY s.created_at LIMIT 1`,
      ),
      pool.query<{ id: string }>("SELECT COALESCE(MAX(id),0)::text id FROM audit_logs"),
    ]);
  assert.ok(assignment.rows[0] && evaluation.rows[0] && survey.rows[0]);
  const assignmentRow = assignment.rows[0];
  const evaluationRow = evaluation.rows[0];
  const surveyRow = survey.rows[0];
  const adminHeaders = {
    Authorization: `Bearer ${tokenFor(admin)}`,
    "Content-Type": "application/json",
  };

  try {
    const forbidden = await fetch(
      `${baseUrl}/api/coursework/admin/assignments/${assignmentRow.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokenFor(student)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId: assignmentRow.course_id,
          title: assignmentRow.title,
          description: assignmentRow.description ?? "",
          dueAt: assignmentRow.due_at,
          maxScore: assignmentRow.max_score,
        }),
      },
    );
    assert.equal(forbidden.status, 403);

    const requests = [
      fetch(`${baseUrl}/api/coursework/admin/assignments/${assignmentRow.id}`, {
        method: "PUT",
        headers: adminHeaders,
        body: JSON.stringify({
          courseId: assignmentRow.course_id,
          title: assignmentRow.title,
          description: assignmentRow.description ?? "",
          dueAt: assignmentRow.due_at,
          maxScore: assignmentRow.max_score,
        }),
      }),
      fetch(`${baseUrl}/api/academic/evaluations/${evaluationRow.id}`, {
        method: "PUT",
        headers: adminHeaders,
        body: JSON.stringify({
          courseId: evaluationRow.course_id,
          title: evaluationRow.title,
          description: evaluationRow.description ?? "",
          type: evaluationRow.type,
          dueAt: evaluationRow.due_at,
        }),
      }),
      fetch(`${baseUrl}/api/academic/surveys/${surveyRow.id}`, {
        method: "PUT",
        headers: adminHeaders,
        body: JSON.stringify({
          courseId: surveyRow.course_id,
          title: surveyRow.title,
          description: surveyRow.description ?? "",
          closesAt: surveyRow.closes_at,
          questions: surveyRow.questions,
        }),
      }),
    ];
    const responses = await Promise.all(requests);
    assert.deepEqual(
      responses.map((response) => response.status),
      [200, 200, 200],
    );
  } finally {
    await pool.query(
      `DELETE FROM audit_logs WHERE id>$1 AND actor_id=$2
       AND action IN ('ASSIGNMENT_UPDATED','EVALUATION_UPDATED','SURVEY_UPDATED')`,
      [auditMarker.rows[0]!.id, admin.id],
    );
  }
});

test("las rutas administrativas aplican permisos de ADMIN y SUPER_ADMIN", async () => {
  const [student, admin, superAdmin] = await Promise.all([
    activeUser("STUDENT"),
    activeUser("ADMIN"),
    activeUser("SUPER_ADMIN"),
  ]);
  const studentResponse = await fetch(`${baseUrl}/api/courses/manage`, {
    headers: { Authorization: `Bearer ${tokenFor(student)}` },
  });
  assert.equal(studentResponse.status, 403);

  const { response, body } = await responseJson<{ success: boolean }>(
    await fetch(`${baseUrl}/api/courses/manage`, {
      headers: { Authorization: `Bearer ${tokenFor(admin)}` },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(body.success, true);

  const studentManagement = await fetch(
    `${baseUrl}/api/management/enrollments`,
    { headers: { Authorization: `Bearer ${tokenFor(student)}` } },
  );
  assert.equal(studentManagement.status, 403);

  const adminEnrollments = await fetch(
    `${baseUrl}/api/management/enrollments`,
    { headers: { Authorization: `Bearer ${tokenFor(admin)}` } },
  );
  assert.equal(adminEnrollments.status, 200);

  const adminSettings = await fetch(
    `${baseUrl}/api/management/payment-settings`,
    { headers: { Authorization: `Bearer ${tokenFor(admin)}` } },
  );
  assert.equal(adminSettings.status, 403);

  const superSettings = await fetch(
    `${baseUrl}/api/management/payment-settings`,
    { headers: { Authorization: `Bearer ${tokenFor(superAdmin)}` } },
  );
  assert.equal(superSettings.status, 200);
});
