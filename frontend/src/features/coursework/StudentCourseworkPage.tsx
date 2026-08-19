import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileQuestion,
  ListChecks,
  Paperclip,
  Search,
  Send,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../../components/Layout";
import { api } from "../../services/api";
import { useFeedback } from "../notifications/feedback-context";
import {
  courseworkKindLabels,
  courseworkPathKind,
  courseworkStatusLabels,
  type CourseworkDetail,
  type CourseworkItem,
  type CourseworkKind,
} from "./types";

type Upload = { data: string; name: string; mime: string };

function KindIcon({ kind }: { kind: CourseworkKind }) {
  if (kind === "ASSIGNMENT") return <ListChecks />;
  if (kind === "QUESTIONNAIRE") return <FileQuestion />;
  return <ClipboardCheck />;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-BO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function readUpload(file: File): Promise<Upload> {
  if (file.size > 4 * 1024 * 1024) {
    throw new Error("El archivo no puede superar los 4 MB");
  }
  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    throw new Error("Solo se permiten archivos PDF, JPG, PNG o WEBP");
  }
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
  return { data, name: file.name, mime: file.type };
}

export function StudentCourseworkPage() {
  const feedback = useFeedback();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<CourseworkItem[]>([]);
  const [selected, setSelected] = useState<CourseworkDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState(searchParams.get("course") ?? "ALL");
  const [kind, setKind] = useState<"ALL" | CourseworkKind>("ALL");
  const [answerText, setAnswerText] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [upload, setUpload] = useState<Upload | null>(null);

  const load = async () => {
    const response = await api<CourseworkItem[]>("/coursework/student");
    setItems(response.data);
  };

  useEffect(() => {
    load().catch((error: Error) =>
      feedback.error("No pudimos cargar tus actividades", error.message),
    );
  }, [feedback]);

  const courses = useMemo(
    () =>
      Array.from(
        new Map(items.map((item) => [item.course_id, item.course_title])).entries(),
      ),
    [items],
  );
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return items.filter(
      (item) =>
        (course === "ALL" || item.course_id === course) &&
        (kind === "ALL" || item.kind === kind) &&
        (!term ||
          `${item.title} ${item.course_title}`
            .toLocaleLowerCase("es")
            .includes(term)),
    );
  }, [course, items, kind, search]);
  const totals = useMemo(
    () => ({
      pending: items.filter((item) => item.status === "NOT_SUBMITTED").length,
      review: items.filter((item) => item.status === "SUBMITTED").length,
      completed: items.filter((item) =>
        ["GRADED", "VERIFIED"].includes(item.status),
      ).length,
      changes: items.filter((item) => item.status === "CHANGES_REQUESTED").length,
    }),
    [items],
  );

  const openItem = async (item: CourseworkItem) => {
    setLoadingDetail(true);
    try {
      const response = await api<CourseworkDetail>(
        `/coursework/student/${courseworkPathKind(item.kind)}/${item.id}`,
      );
      setSelected(response.data);
      setAnswerText(response.data.answer_text ?? "");
      setAnswers(response.data.answers ?? {});
      setUpload(null);
    } catch (error) {
      feedback.error("No se pudo abrir la actividad", (error as Error).message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    try {
      if (selected.kind === "QUESTIONNAIRE") {
        await api(`/coursework/student/questionnaire/${selected.id}/submit`, {
          method: "POST",
          body: JSON.stringify({ answers }),
        });
      } else {
        await api(
          `/coursework/student/${courseworkPathKind(selected.kind)}/${selected.id}/submit`,
          {
            method: "POST",
            body: JSON.stringify({
              answerText,
              attachmentData: upload?.data,
              attachmentName: upload?.name,
              attachmentMime: upload?.mime,
            }),
          },
        );
      }
      feedback.success(
        "Entrega enviada",
        "El equipo académico recibió tu trabajo y te notificará al revisarlo.",
      );
      setSelected(null);
      await load();
    } catch (error) {
      feedback.error("No se pudo enviar", (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    selected &&
    ["NOT_SUBMITTED", "CHANGES_REQUESTED"].includes(selected.status) &&
    (!selected.is_overdue || selected.status === "CHANGES_REQUESTED");

  return (
    <DashboardLayout>
      <div className="coursework-page">
        <header className="coursework-hero">
          <div>
            <span>ESPACIO DE ENTREGAS</span>
            <h1>Tareas y evaluaciones</h1>
            <p>Consulta instrucciones, entrega tu trabajo y sigue cada revisión.</p>
          </div>
          <div className="coursework-flow" aria-label="Flujo de una entrega">
            <span className="active"><b>1</b> Entrega</span>
            <i />
            <span><b>2</b> Revisión</span>
            <i />
            <span><b>3</b> Resultado</span>
          </div>
        </header>

        <section className="coursework-kpis">
          <article className="violet"><Clock3 /><div><strong>{totals.pending}</strong><span>Por entregar</span></div></article>
          <article className="blue"><FileCheck2 /><div><strong>{totals.review}</strong><span>En revisión</span></div></article>
          <article className="green"><CheckCircle2 /><div><strong>{totals.completed}</strong><span>Completadas</span></div></article>
          <article className="orange"><AlertTriangle /><div><strong>{totals.changes}</strong><span>Con cambios</span></div></article>
        </section>

        <section className="coursework-panel">
          <div className="coursework-toolbar">
            <label><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tarea, evaluación o curso..." /></label>
            <select value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="ALL">Todos mis cursos</option>
              {courses.map(([id, title]) => <option value={id} key={id}>{title}</option>)}
            </select>
            <div className="coursework-tabs">
              {(["ALL", "ASSIGNMENT", "EVALUATION", "QUESTIONNAIRE"] as const).map((value) => (
                <button className={kind === value ? "active" : ""} onClick={() => setKind(value)} key={value}>
                  {value === "ALL" ? "Todo" : courseworkKindLabels[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="coursework-list">
            {visible.map((item) => (
              <article className={`coursework-row ${item.kind.toLowerCase()}`} key={`${item.kind}-${item.id}`}>
                <i><KindIcon kind={item.kind} /></i>
                <div className="coursework-row-main">
                  <span>{courseworkKindLabels[item.kind]} · {item.course_title}</span>
                  <h2>{item.title}</h2>
                  <p>{item.description || "Revisa las indicaciones y completa la actividad."}</p>
                </div>
                <div className="coursework-date"><CalendarClock /><span><small>Fecha límite</small><strong>{formatDate(item.due_at)}</strong></span></div>
                <div className={`coursework-status ${item.status.toLowerCase()}`}>{courseworkStatusLabels[item.status]}</div>
                <button className="coursework-open" disabled={loadingDetail} onClick={() => openItem(item)}>
                  {item.status === "NOT_SUBMITTED" ? "Comenzar" : item.status === "CHANGES_REQUESTED" ? "Corregir" : "Ver detalle"}
                </button>
              </article>
            ))}
            {!visible.length && (
              <div className="coursework-empty"><ClipboardCheck /><h2>No hay actividades con estos filtros</h2><p>Cuando tu curso publique una actividad aparecerá aquí.</p></div>
            )}
          </div>
        </section>
      </div>

      {selected && (
        <div className="coursework-modal-backdrop">
          <form className="coursework-modal" onSubmit={submit}>
            <header>
              <div><span>{courseworkKindLabels[selected.kind]} · {selected.course_title}</span><h2>{selected.title}</h2></div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Cerrar"><X /></button>
            </header>
            <div className="coursework-modal-meta">
              <span><CalendarClock /> Vence {formatDate(selected.due_at)}</span>
              <span className={`coursework-status ${selected.status.toLowerCase()}`}>{courseworkStatusLabels[selected.status]}</span>
              {selected.max_score && <span>{selected.max_score} puntos</span>}
            </div>
            {selected.description && <div className="coursework-instructions"><strong>Indicaciones</strong><p>{selected.description}</p></div>}
            {selected.feedback && (
              <div className={`coursework-feedback ${selected.status === "CHANGES_REQUESTED" ? "warning" : "success"}`}>
                <strong>Devolución del administrador</strong><p>{selected.feedback}</p>
                {selected.score != null && <b>Calificación: {selected.score} / {selected.max_score}</b>}
              </div>
            )}
            {selected.kind === "QUESTIONNAIRE" ? (
              <div className="coursework-questions">
                {selected.questions?.map((question, index) => (
                  <label key={question.id}><span>{index + 1}</span><strong>{question.prompt}</strong><textarea required disabled={!canSubmit} value={answers[question.id] ?? ""} onChange={(e) => setAnswers((current) => ({ ...current, [question.id]: e.target.value }))} /></label>
                ))}
              </div>
            ) : (
              <div className="coursework-delivery">
                <label><strong>Tu respuesta</strong><textarea disabled={!canSubmit} value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="Escribe aquí el desarrollo, enlace o comentario de tu entrega..." /></label>
                {canSubmit && (
                  <label className="coursework-upload"><UploadCloud /><strong>{upload?.name ?? "Adjuntar evidencia"}</strong><span>PDF, JPG, PNG o WEBP · máximo 4 MB</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) readUpload(file).then(setUpload).catch((error: Error) => feedback.warning("Archivo no válido", error.message)); }} /></label>
                )}
                {!canSubmit && selected.attachment_name && <div className="coursework-file"><Paperclip /><span><strong>Archivo enviado</strong>{selected.attachment_name}</span></div>}
              </div>
            )}
            {canSubmit ? (
              <button className="coursework-submit" disabled={submitting}><Send />{submitting ? "Enviando..." : selected.status === "CHANGES_REQUESTED" ? "Enviar corrección" : "Enviar actividad"}</button>
            ) : (
              <div className="coursework-locked"><CheckCircle2 />{selected.status === "SUBMITTED" ? "Tu entrega está esperando revisión." : selected.is_overdue && selected.status === "NOT_SUBMITTED" ? "El plazo de esta actividad finalizó." : "Esta actividad ya fue revisada."}</div>
            )}
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
