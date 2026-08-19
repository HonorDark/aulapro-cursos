import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileQuestion,
  Inbox,
  ListChecks,
  Search,
  Send,
  TimerReset,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DashboardLayout } from "../../components/Layout";
import { api } from "../../services/api";
import { useFeedback } from "../notifications/feedback-context";
import {
  courseworkKindLabels,
  courseworkPathKind,
  courseworkStatusLabels,
  type CourseworkDetail,
  type CourseworkKind,
  type SubmissionRow,
} from "./types";

function ReviewIcon({ kind }: { kind: CourseworkKind }) {
  if (kind === "ASSIGNMENT") return <ListChecks />;
  if (kind === "QUESTIONNAIRE") return <FileQuestion />;
  return <ClipboardCheck />;
}

export function AdminSubmissionsPage() {
  const feedback = useFeedback();
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [detail, setDetail] = useState<CourseworkDetail | null>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"ALL" | CourseworkKind>("ALL");
  const [status, setStatus] = useState("ALL");
  const [course, setCourse] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<"APPROVED" | "CHANGES_REQUESTED">("APPROVED");

  const load = async () => {
    const response = await api<SubmissionRow[]>("/coursework/admin/submissions");
    setRows(response.data);
  };
  useEffect(() => {
    load().catch((error: Error) =>
      feedback.error("No pudimos cargar las entregas", error.message),
    );
  }, [feedback]);

  const courses = useMemo(
    () => Array.from(new Map(rows.map((row) => [row.course_id, row.course_title])).entries()),
    [rows],
  );
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return rows.filter((row) =>
      (kind === "ALL" || row.kind === kind) &&
      (status === "ALL" || row.status === status) &&
      (course === "ALL" || row.course_id === course) &&
      (!term || `${row.student_name} ${row.student_email} ${row.activity_title} ${row.course_title}`.toLocaleLowerCase("es").includes(term)),
    );
  }, [course, kind, rows, search, status]);
  const totals = useMemo(() => ({
    pending: rows.filter((row) => row.status === "SUBMITTED").length,
    changes: rows.filter((row) => row.status === "CHANGES_REQUESTED").length,
    reviewed: rows.filter((row) => ["GRADED", "VERIFIED"].includes(row.status)).length,
    total: rows.length,
  }), [rows]);

  const open = async (row: SubmissionRow) => {
    setLoading(true);
    try {
      const response = await api<CourseworkDetail>(`/coursework/admin/submissions/${courseworkPathKind(row.kind)}/${row.id}`);
      setDetail({ ...response.data, kind: row.kind, status: row.status } as CourseworkDetail);
      setDecision("APPROVED");
    } catch (error) {
      feedback.error("No se pudo abrir la entrega", (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const review = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      await api(`/coursework/admin/submissions/${courseworkPathKind(detail.kind)}/${detail.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          score: detail.kind === "QUESTIONNAIRE" || decision === "CHANGES_REQUESTED" ? null : form.get("score"),
          feedback: form.get("feedback"),
        }),
      });
      feedback.success(decision === "APPROVED" ? "Revisión completada" : "Corrección solicitada", "El estudiante recibió una notificación con tu devolución.");
      setDetail(null);
      await load();
    } catch (error) {
      feedback.error("No se pudo guardar la revisión", (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="coursework-page admin-review-page">
        <header className="coursework-hero admin">
          <div><span>SEGUIMIENTO ACADÉMICO</span><h1>Bandeja de entregas</h1><p>Verifica tareas, cuestionarios y evaluaciones de todos los cursos.</p></div>
          <div className="review-hero-badge"><Inbox /><span><strong>{totals.pending}</strong> pendientes por revisar</span></div>
        </header>
        <section className="coursework-kpis">
          <article className="violet"><Inbox /><div><strong>{totals.total}</strong><span>Entregas recibidas</span></div></article>
          <article className="blue"><TimerReset /><div><strong>{totals.pending}</strong><span>Por revisar</span></div></article>
          <article className="orange"><AlertTriangle /><div><strong>{totals.changes}</strong><span>Con correcciones</span></div></article>
          <article className="green"><CheckCircle2 /><div><strong>{totals.reviewed}</strong><span>Revisadas</span></div></article>
        </section>
        <section className="coursework-panel review-panel">
          <div className="coursework-toolbar review-toolbar">
            <label><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar estudiante, curso o actividad..." /></label>
            <select value={course} onChange={(e) => setCourse(e.target.value)}><option value="ALL">Todos los cursos</option>{courses.map(([id, title]) => <option value={id} key={id}>{title}</option>)}</select>
            <select value={kind} onChange={(e) => setKind(e.target.value as "ALL" | CourseworkKind)}><option value="ALL">Todos los tipos</option><option value="ASSIGNMENT">Tareas</option><option value="EVALUATION">Evaluaciones</option><option value="QUESTIONNAIRE">Cuestionarios</option></select>
            <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">Todos los estados</option><option value="SUBMITTED">Por revisar</option><option value="CHANGES_REQUESTED">Cambios solicitados</option><option value="GRADED">Calificadas</option><option value="VERIFIED">Verificadas</option></select>
          </div>
          <div className="review-table-wrap">
            <table className="review-table">
              <thead><tr><th>Estudiante</th><th>Actividad</th><th>Curso</th><th>Entregada</th><th>Estado</th><th>Nota</th><th /></tr></thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={`${row.kind}-${row.id}`}>
                    <td><div className="review-student"><span>{row.student_name[0]}</span><div><strong>{row.student_name}</strong><small>{row.student_email}</small></div></div></td>
                    <td><div className={`review-activity ${row.kind.toLowerCase()}`}><i><ReviewIcon kind={row.kind} /></i><span><strong>{row.activity_title}</strong><small>{courseworkKindLabels[row.kind]}</small></span></div></td>
                    <td>{row.course_title}</td>
                    <td>{new Date(row.submitted_at).toLocaleDateString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td><span className={`coursework-status ${row.status.toLowerCase()}`}>{courseworkStatusLabels[row.status]}</span></td>
                    <td>{row.score == null ? "—" : `${row.score} / ${row.max_score}`}</td>
                    <td><button className="review-open" disabled={loading} onClick={() => open(row)}><Eye /> Revisar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && <div className="coursework-empty"><Inbox /><h2>No hay entregas con estos filtros</h2><p>Las nuevas respuestas aparecerán automáticamente en esta bandeja.</p></div>}
          </div>
        </section>
      </div>
      {detail && (
        <div className="coursework-modal-backdrop">
          <form className="coursework-modal review-modal" onSubmit={review}>
            <header><div><span>{courseworkKindLabels[detail.kind]} · {detail.course_title}</span><h2>{detail.activity_title}</h2><p>{detail.student_name} · {detail.student_email}</p></div><button type="button" onClick={() => setDetail(null)} aria-label="Cerrar"><X /></button></header>
            {detail.description && <div className="coursework-instructions"><strong>Consigna</strong><p>{detail.description}</p></div>}
            {detail.kind === "QUESTIONNAIRE" ? (
              <div className="review-answers">{detail.questions?.map((question, index) => <article key={question.id}><span>{index + 1}</span><div><strong>{question.prompt}</strong><p>{detail.answers?.[question.id] || "Sin respuesta"}</p></div></article>)}</div>
            ) : (
              <div className="review-delivery"><strong>Respuesta del estudiante</strong><p>{detail.answer_text || "La entrega contiene únicamente un archivo adjunto."}</p>{detail.attachment_data && <a href={detail.attachment_data} download={detail.attachment_name ?? "evidencia"}><Download /> Descargar {detail.attachment_name}</a>}</div>
            )}
            {detail.feedback && <div className="coursework-feedback"><strong>Última devolución</strong><p>{detail.feedback}</p></div>}
            <div className="review-decision"><button type="button" className={decision === "APPROVED" ? "approve active" : "approve"} onClick={() => setDecision("APPROVED")}><CheckCircle2 /> {detail.kind === "QUESTIONNAIRE" ? "Verificar" : "Aprobar y calificar"}</button><button type="button" className={decision === "CHANGES_REQUESTED" ? "changes active" : "changes"} onClick={() => setDecision("CHANGES_REQUESTED")}><TimerReset /> Solicitar cambios</button></div>
            {detail.kind !== "QUESTIONNAIRE" && decision === "APPROVED" && <label className="review-score"><strong>Calificación</strong><div><input name="score" type="number" min="0" max={Number(detail.max_score ?? 100)} step="0.01" required /><span>/ {detail.max_score ?? 100} puntos</span></div></label>}
            <label className="review-feedback"><strong>{decision === "APPROVED" ? "Devolución para el estudiante" : "Cambios que debe realizar"}</strong><textarea name="feedback" required minLength={3} maxLength={2000} placeholder={decision === "APPROVED" ? "Explica el resultado y destaca los puntos importantes..." : "Indica claramente qué debe corregir antes de reenviar..."} /></label>
            <button className={`coursework-submit ${decision === "CHANGES_REQUESTED" ? "warning" : ""}`} disabled={submitting}><Send />{submitting ? "Guardando revisión..." : decision === "APPROVED" ? "Guardar revisión" : "Enviar solicitud de cambios"}</button>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
