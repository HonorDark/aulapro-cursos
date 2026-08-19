import {
  Archive,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileQuestion,
  ListChecks,
  Plus,
  Pencil,
  RotateCcw,
  Search,
  Send,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "../components/Layout";
import { api } from "../services/api";
import type { Course } from "../types";
import type { CourseworkItem } from "../features/coursework/types";
import { useFeedback } from "../features/notifications/feedback-context";
type Event = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  event_date: string;
  kind: "EVALUATION" | "SURVEY" | "ASSIGNMENT";
  course_id: string;
  course_title: string;
  is_published?: boolean;
  responses?: number;
  responded?: boolean;
  max_score?: number;
  is_archived?: boolean;
};
type Survey = {
  id: string;
  title: string;
  description: string;
  course_title: string;
  closes_at: string;
  questions: Array<{ id: string; prompt: string; position: number }>;
};
type AdminSurvey = Omit<Survey, "description"> & {
  description: string | null;
  course_id: string;
  is_archived: boolean;
};

const dateTimeValue = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};
const labels: Record<string, string> = {
  EXAM: "Examen",
  PROJECT: "Proyecto",
  PRACTICE: "Práctica",
  QUIZ: "Quiz",
  SURVEY: "Cuestionario",
  TASK: "Tarea",
};
function CalendarView({
  events,
  month,
  setMonth,
}: {
  events: Event[];
  month: Date;
  setMonth: (d: Date) => void;
}) {
  const year = month.getFullYear(),
    m = month.getMonth(),
    first = (new Date(year, m, 1).getDay() + 6) % 7,
    days = new Date(year, m + 1, 0).getDate();
  const cells = Array.from({ length: first + days }, (_, i) =>
    i < first ? null : i - first + 1,
  );
  return (
    <section className="academic-calendar">
      <header>
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => setMonth(new Date(year, m - 1, 1))}
        >
          <ChevronLeft />
        </button>
        <h2>
          {month.toLocaleDateString("es", { month: "long", year: "numeric" })}
        </h2>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => setMonth(new Date(year, m + 1, 1))}
        >
          <ChevronRight />
        </button>
      </header>
      <div className="weekdays">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
      <div className="month-grid">
        {cells.map((day, index) => (
          <article
            key={index}
            className={
              !day
                ? "empty-day"
                : day === new Date().getDate() &&
                    m === new Date().getMonth() &&
                    year === new Date().getFullYear()
                  ? "today"
                  : ""
            }
          >
            {day && (
              <>
                <strong>{day}</strong>
                {events
                  .filter((e) => {
                    const d = new Date(e.event_date);
                    return (
                      d.getDate() === day &&
                      d.getMonth() === m &&
                      d.getFullYear() === year
                    );
                  })
                  .slice(0, 3)
                  .map((e) => (
                    <span
                      key={e.id}
                      className={e.kind.toLowerCase()}
                      title={e.title}
                    >
                      {e.title}
                    </span>
                  ))}
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
export function StudentCalendar() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [month, setMonth] = useState(new Date());
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const load = async (signal?: AbortSignal) => {
    const [academic, coursework] = await Promise.all([
      api<Event[]>("/academic/student", { signal }),
      api<CourseworkItem[]>("/coursework/student", { signal }),
    ]);
    if (signal?.aborted) return;
    setEvents([
        ...academic.data,
        ...coursework.data
          .filter((item) => item.kind === "ASSIGNMENT")
          .map<Event>((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            type: "TASK",
            event_date: item.due_at,
            kind: "ASSIGNMENT",
            course_id: item.course_id,
            course_title: item.course_title,
            responded: item.status !== "NOT_SUBMITTED",
          })),
      ]);
  };
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch((error: Error) => {
      if (error.name !== "AbortError") setMessage(error.message);
    });
    return () => controller.abort();
  }, []);
  const upcoming = events
    .filter((e) => new Date(e.event_date) >= new Date())
    .slice(0, 8);
  const openSurvey = async (event: Event) => {
    if (event.responded) return;
    try {
      const r = await api<Survey>(`/academic/surveys/${event.id}`);
      setSurvey(r.data);
      setAnswers({});
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const respond = async (e: FormEvent) => {
    e.preventDefault();
    if (!survey) return;
    try {
      await api(`/academic/surveys/${survey.id}/respond`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      setSurvey(null);
      setMessage("Cuestionario enviado correctamente.");
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };
  return (
    <DashboardLayout>
      <div className="academic-page-head">
        <div>
          <span>MI AGENDA</span>
          <h1>Calendario académico</h1>
          <p>Tareas, evaluaciones y cuestionarios de tus cursos.</p>
        </div>
        <i>
          <CalendarDays />
        </i>
      </div>
      {message && <div className="academic-message">{message}</div>}
      <div className="calendar-layout">
        <CalendarView events={events} month={month} setMonth={setMonth} />
        <aside className="agenda-list">
          <header>
            <h2>Próximas actividades</h2>
            <span>{upcoming.length}</span>
          </header>
          {upcoming.map((event) => (
            <article key={`${event.kind}-${event.id}`}>
              <time>
                <strong>{new Date(event.event_date).getDate()}</strong>
                <span>
                  {new Date(event.event_date).toLocaleDateString("es", {
                    month: "short",
                  })}
                </span>
              </time>
              <div>
                <i className={event.kind.toLowerCase()}>
                  {event.kind === "SURVEY" ? (
                    <FileQuestion />
                  ) : event.kind === "ASSIGNMENT" ? (
                    <ListChecks />
                  ) : (
                    <ClipboardCheck />
                  )}
                </i>
                <span>
                  <strong>{event.title}</strong>
                  <small>
                    {event.course_title} · {labels[event.type] ?? event.type}
                  </small>
                </span>
              </div>
              {event.kind === "SURVEY" && (
                <button
                  disabled={event.responded}
                  onClick={() => openSurvey(event)}
                >
                  {event.responded ? "Respondida" : "Responder"}
                </button>
              )}
              {event.kind !== "SURVEY" && (
                <button onClick={() => navigate("/student/tasks")}>Abrir</button>
              )}
            </article>
          ))}
        </aside>
      </div>
      {survey && (
        <div className="survey-modal">
          <form onSubmit={respond}>
            <header>
              <div>
                <span>CUESTIONARIO DEL CURSO</span>
                <h2>{survey.title}</h2>
                <p>{survey.course_title}</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar cuestionario"
                onClick={() => setSurvey(null)}
              >
                <X />
              </button>
            </header>
            {survey.description && <p>{survey.description}</p>}
            <div className="survey-questions">
              {survey.questions.map((q, i) => (
                <label key={q.id}>
                  <span>{i + 1}</span>
                  <strong>{q.prompt}</strong>
                  <textarea
                    required
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers({ ...answers, [q.id]: e.target.value })
                    }
                    placeholder="Escribe tu respuesta"
                  />
                </label>
              ))}
            </div>
            <button className="send-survey">
              <Send />
              Enviar cuestionario
            </button>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
export function AcademicManagement() {
  const feedback = useFeedback();
  const [events, setEvents] = useState<Event[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [month, setMonth] = useState(new Date());
  const [show, setShow] = useState<
    "ASSIGNMENT" | "EVALUATION" | "SURVEY" | null
  >(null);
  const [editing, setEditing] = useState<Event | null>(null);
  const [questions, setQuestions] = useState([""]);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [eventSearch, setEventSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<
    "ALL" | "ASSIGNMENT" | "EVALUATION" | "SURVEY"
  >("ALL");
  const [showArchived, setShowArchived] = useState(false);
  const load = async (signal?: AbortSignal) => {
    const [academic, tasks, coursesResponse] = await Promise.all([
      api<Event[]>("/academic/admin?includeArchived=true", { signal }),
      api<Event[]>("/coursework/admin/assignments?includeArchived=true", { signal }),
      api<Course[]>("/courses/manage", { signal }),
    ]);
    if (signal?.aborted) return;
    setEvents([...academic.data, ...tasks.data]);
    setCourses(coursesResponse.data);
  };
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch((error: Error) => {
      if (error.name !== "AbortError") setMessage(error.message);
    });
    return () => controller.abort();
  }, []);
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!show) return;
    const f = new FormData(e.currentTarget);
    setFormError("");
    setSubmitting(true);
    try {
      if (show === "ASSIGNMENT")
        await api(
          editing
            ? `/coursework/admin/assignments/${editing.id}`
            : "/coursework/admin/assignments",
          {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify({
            courseId: f.get("courseId"),
            title: f.get("title"),
            description: f.get("description"),
            dueAt: f.get("date"),
            maxScore: f.get("maxScore"),
            isPublished: true,
          }),
          },
        );
      else if (show === "EVALUATION")
        await api(editing ? `/academic/evaluations/${editing.id}` : "/academic/evaluations", {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify({
            courseId: f.get("courseId"),
            title: f.get("title"),
            description: f.get("description"),
            type: f.get("type"),
            dueAt: f.get("date"),
            isPublished: true,
          }),
        });
      else
        await api(editing ? `/academic/surveys/${editing.id}` : "/academic/surveys", {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify({
            courseId: f.get("courseId"),
            title: f.get("title"),
            description: f.get("description"),
            closesAt: f.get("date"),
            isPublished: true,
            questions: questions.map((question) => question.trim()),
          }),
        });
      setShow(null);
      setEditing(null);
      setQuestions([""]);
      feedback.success(
        editing ? "Actividad actualizada" : "Actividad creada",
        editing
          ? "Los cambios académicos se guardaron correctamente."
          : "La actividad quedó publicada para los estudiantes.",
      );
      await load();
    } catch (error) {
      setFormError((error as Error).message);
      feedback.error("No se pudo guardar", (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };
  const publish = async (event: Event) => {
    try {
      await api(
        event.kind === "ASSIGNMENT"
          ? `/coursework/admin/assignments/${event.id}/publish`
          : `/academic/${event.kind === "SURVEY" ? "survey" : "evaluation"}/${event.id}/publish`,
        {
          method: "PATCH",
          body: JSON.stringify({ isPublished: !event.is_published }),
        },
      );
      setMessage(
        event.is_published
          ? "Actividad despublicada correctamente."
          : "Actividad publicada correctamente.",
      );
      feedback.success(
        event.is_published ? "Actividad despublicada" : "Actividad publicada",
      );
      await load();
    } catch (error) {
      feedback.error("No se pudo cambiar la publicación", (error as Error).message);
    }
  };
  const openCreate = (
    kind: "ASSIGNMENT" | "EVALUATION" | "SURVEY",
  ) => {
    setFormError("");
    setQuestions([""]);
    setEditing(null);
    setShow(kind);
  };
  const openEdit = async (event: Event) => {
    if (event.is_archived) return;
    setFormError("");
    setEditing(event);
    if (event.kind === "SURVEY") {
      try {
        const response = await api<AdminSurvey>(`/academic/admin/surveys/${event.id}`);
        setQuestions(response.data.questions.map((question) => question.prompt));
      } catch (error) {
        feedback.error("No se pudo abrir el cuestionario", (error as Error).message);
        setEditing(null);
        return;
      }
    } else {
      setQuestions([""]);
    }
    setShow(event.kind);
  };
  const archive = async (event: Event) => {
    const restoring = Boolean(event.is_archived);
    if (!restoring) {
      const accepted = await feedback.confirm({
        title: "Archivar actividad",
        message:
          "Dejará de estar disponible para estudiantes, pero conservará todas las entregas y respuestas.",
        confirmLabel: "Archivar",
        tone: "danger",
      });
      if (!accepted) return;
    }
    try {
      await api(
        event.kind === "ASSIGNMENT"
          ? `/coursework/admin/assignments/${event.id}/archive`
          : `/academic/${event.kind === "SURVEY" ? "survey" : "evaluation"}/${event.id}/archive`,
        {
          method: "PATCH",
          body: JSON.stringify({ isArchived: !event.is_archived }),
        },
      );
      feedback.success(
        restoring ? "Actividad restaurada" : "Actividad archivada",
        restoring
          ? "Puedes editarla y publicarla nuevamente."
          : "El historial y las entregas se conservaron.",
      );
      await load();
    } catch (error) {
      feedback.error("No se pudo actualizar el archivo", (error as Error).message);
    }
  };
  const totals = useMemo(
    () => ({
      assignments: events.filter((x) => x.kind === "ASSIGNMENT" && !x.is_archived).length,
      evaluations: events.filter((x) => x.kind === "EVALUATION" && !x.is_archived).length,
      surveys: events.filter((x) => x.kind === "SURVEY" && !x.is_archived).length,
      responses: events
        .filter((x) => !x.is_archived)
        .reduce((s, x) => s + (x.responses ?? 0), 0),
    }),
    [events],
  );
  const visibleEvents = useMemo(() => {
    const term = eventSearch.trim().toLocaleLowerCase("es");
    return events.filter((event) => {
      const matchesType = eventFilter === "ALL" || event.kind === eventFilter;
      const matchesArchive = Boolean(event.is_archived) === showArchived;
      const matchesSearch =
        !term ||
        `${event.title} ${event.course_title} ${labels[event.type] ?? event.type}`
          .toLocaleLowerCase("es")
          .includes(term);
      return matchesType && matchesArchive && matchesSearch;
    });
  }, [eventFilter, eventSearch, events, showArchived]);
  const editHasResponses = Boolean(editing && (editing.responses ?? 0) > 0);
  return (
    <DashboardLayout>
      <div className="academic-management-view">
        <div className="academic-page-head admin">
          <div>
            <span>GESTIÓN ACADÉMICA</span>
            <h1>Calendario y actividades</h1>
            <p>
              Publica tareas, evaluaciones y cuestionarios por curso.
            </p>
          </div>
          <div>
            <button
              onClick={() => openCreate("ASSIGNMENT")}
              disabled={!courses.length}
            >
              <ListChecks />
              Crear tarea
            </button>
            <button
              onClick={() => openCreate("SURVEY")}
              disabled={!courses.length}
            >
              <FileQuestion />
              Crear cuestionario
            </button>
            <button
              onClick={() => openCreate("EVALUATION")}
              disabled={!courses.length}
            >
              <Plus />
              Crear evaluación
            </button>
          </div>
        </div>
        {message && <div className="academic-message">{message}</div>}
        <section className="academic-tools">
          <label>
            <Search />
            <input
              value={eventSearch}
              onChange={(event) => setEventSearch(event.target.value)}
              placeholder="Buscar actividad o curso..."
            />
          </label>
          <div role="tablist" aria-label="Filtrar actividades">
            {(
              [
                ["ALL", "Todas"],
                ["ASSIGNMENT", "Tareas"],
                ["EVALUATION", "Evaluaciones"],
                ["SURVEY", "Cuestionarios"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={eventFilter === value ? "active" : ""}
                onClick={() => setEventFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="academic-archive-filter" aria-label="Estado de archivo">
            <button
              type="button"
              className={!showArchived ? "active" : ""}
              onClick={() => setShowArchived(false)}
            >
              Activas
            </button>
            <button
              type="button"
              className={showArchived ? "active" : ""}
              onClick={() => setShowArchived(true)}
            >
              <Archive /> Archivadas
            </button>
          </div>
          <span>
            <strong>{visibleEvents.length}</strong> actividades visibles
          </span>
        </section>
        <div className="academic-kpis">
          <article>
            <ListChecks />
            <span>
              <strong>{totals.assignments}</strong>Tareas
            </span>
          </article>
          <article>
            <ClipboardCheck />
            <span>
              <strong>{totals.evaluations}</strong>Evaluaciones
            </span>
          </article>
          <article>
            <FileQuestion />
            <span>
              <strong>{totals.surveys}</strong>Cuestionarios
            </span>
          </article>
          <article>
            <BarChart3 />
            <span>
              <strong>{totals.responses}</strong>Respuestas recibidas
            </span>
          </article>
        </div>
        <div className="calendar-layout admin">
          <CalendarView
            events={visibleEvents}
            month={month}
            setMonth={setMonth}
          />
          <aside className="agenda-list manage">
            <header>
              <h2>Actividades programadas</h2>
              <span>{visibleEvents.length}</span>
            </header>
            {visibleEvents.slice(0, 9).map((event) => (
              <article
                key={`${event.kind}-${event.id}`}
                className={event.is_archived ? "archived" : ""}
              >
                <div>
                  <i className={event.kind.toLowerCase()}>
                    {event.kind === "SURVEY" ? (
                      <FileQuestion />
                    ) : event.kind === "ASSIGNMENT" ? (
                      <ListChecks />
                    ) : (
                      <ClipboardCheck />
                    )}
                  </i>
                  <span>
                    <strong>{event.title}</strong>
                    <small>
                      {event.course_title} ·{" "}
                      {new Date(event.event_date).toLocaleDateString("es")}
                    </small>
                    {event.is_archived && <em>Archivada</em>}
                  </span>
                </div>
                <div className="academic-event-actions">
                  {!event.is_archived && (
                    <button
                      type="button"
                      onClick={() => void openEdit(event)}
                      title="Editar actividad"
                      aria-label={`Editar ${event.title}`}
                    >
                      <Pencil />
                    </button>
                  )}
                  {!event.is_archived && (
                    <button
                      type="button"
                      className="publish-toggle"
                      onClick={() => publish(event)}
                      title={event.is_published ? "Despublicar" : "Publicar"}
                    >
                      {event.is_published ? <ToggleRight /> : <ToggleLeft />}
                    </button>
                  )}
                  <button
                    type="button"
                    className={event.is_archived ? "restore" : "archive"}
                    onClick={() => void archive(event)}
                    title={event.is_archived ? "Restaurar" : "Archivar"}
                    aria-label={`${event.is_archived ? "Restaurar" : "Archivar"} ${event.title}`}
                  >
                    {event.is_archived ? <RotateCcw /> : <Archive />}
                  </button>
                </div>
              </article>
            ))}
            {!visibleEvents.length && (
              <div className="agenda-empty">
                <Search />
                <strong>No encontramos actividades</strong>
                <span>Prueba con otro término o filtro.</span>
              </div>
            )}
          </aside>
        </div>
        {show && (
          <div className="academic-modal">
          <form onSubmit={save} key={`${show}-${editing?.id ?? "new"}`}>
              <header>
                <div>
                  <span>
                    {show === "ASSIGNMENT"
                      ? editing ? "EDITAR TAREA" : "NUEVA TAREA"
                      : show === "EVALUATION"
                        ? editing ? "EDITAR EVALUACIÓN" : "NUEVA EVALUACIÓN"
                        : editing ? "EDITAR CUESTIONARIO" : "NUEVO CUESTIONARIO"}
                  </span>
                  <h2>
                    {show === "ASSIGNMENT"
                      ? editing ? "Actualiza la tarea" : "Publica una tarea del curso"
                      : show === "EVALUATION"
                        ? editing ? "Actualiza la evaluación" : "Programa una evaluación"
                        : editing ? "Actualiza el cuestionario" : "Crea un cuestionario"}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar formulario"
                  onClick={() => {
                    setShow(null);
                    setEditing(null);
                  }}
                >
                  <X />
                </button>
            </header>
            {formError && (
              <div className="academic-form-error">{formError}</div>
            )}
            <label>
                Curso
                {editHasResponses && (
                  <input type="hidden" name="courseId" value={editing!.course_id} />
                )}
                <select
                  name={editHasResponses ? "courseDisplay" : "courseId"}
                  required
                  disabled={editHasResponses}
                  defaultValue={editing?.course_id}
                >
                  {courses.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Título
              <input
                name="title"
                required
                minLength={3}
                maxLength={180}
                defaultValue={editing?.title}
              />
              </label>
              <label>
                Descripción
                <textarea
                name="description"
                maxLength={1000}
                defaultValue={editing?.description ?? ""}
                  placeholder="Indicaciones para los estudiantes"
                />
              </label>
              <div className="academic-form-row">
                {show === "EVALUATION" && (
                  <label>
                    Tipo
                    <select name="type" defaultValue={editing?.type ?? "EXAM"}>
                      <option value="EXAM">Examen</option>
                      <option value="QUIZ">Quiz</option>
                      <option value="PROJECT">Proyecto</option>
                      <option value="PRACTICE">Práctica</option>
                    </select>
                  </label>
                )}
                {show === "ASSIGNMENT" && (
                  <label>
                    Puntaje máximo
                    <input
                      name="maxScore"
                      type="number"
                      min="1"
                      max="1000"
                      defaultValue={editing?.max_score ?? 100}
                      required
                    />
                  </label>
                )}
                <label>
                  {show === "SURVEY" ? "Cierre del cuestionario" : "Fecha límite"}
                <input
                  name="date"
                  type="datetime-local"
                  required
                  defaultValue={dateTimeValue(editing?.event_date)}
                  min={
                    editing
                      ? undefined
                      : new Date(
                          Date.now() - new Date().getTimezoneOffset() * 60_000,
                        )
                          .toISOString()
                          .slice(0, 16)
                  }
                />
                </label>
              </div>
              {show === "SURVEY" && (
                <div className="question-builder">
                  <strong>Preguntas ({questions.length}/12)</strong>
                  {editHasResponses && (
                    <p className="academic-edit-note">
                      Ya existen respuestas. Puedes editar título, descripción y fecha,
                      pero conservamos el curso y las preguntas para proteger el historial.
                    </p>
                  )}
                  {questions.map((q, i) => (
                    <div key={i}>
                      <span>{i + 1}</span>
                      <input
                        value={q}
                        disabled={editHasResponses}
                        onChange={(e) =>
                          setQuestions((items) =>
                            items.map((x, n) => (n === i ? e.target.value : x)),
                          )
                        }
                      required
                      minLength={3}
                      maxLength={500}
                        placeholder="Escribe la pregunta"
                      />
                      {questions.length > 1 && (
                        <button
                          type="button"
                          disabled={editHasResponses}
                          aria-label={`Eliminar pregunta ${i + 1}`}
                          onClick={() =>
                            setQuestions((items) =>
                              items.filter((_, n) => n !== i),
                            )
                          }
                        >
                          <X />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={questions.length >= 12 || editHasResponses}
                    onClick={() =>
                      setQuestions((items) =>
                        items.length < 12 ? [...items, ""] : items,
                      )
                    }
                  >
                    <Plus />
                    {questions.length >= 12
                      ? "Límite de 12 preguntas"
                      : "Agregar pregunta"}
                  </button>
                </div>
              )}
            <button
              className="create-academic"
              type="submit"
              disabled={submitting}
            >
              <Check />
              {submitting
                ? "Guardando actividad..."
                : editing
                  ? "Guardar cambios"
                  : "Crear y publicar"}
              </button>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
