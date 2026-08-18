import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileQuestion,
  Plus,
  Search,
  Send,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DashboardLayout } from "../components/Layout";
import { api } from "../services/api";
import type { Course } from "../types";
type Event = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  event_date: string;
  kind: "EVALUATION" | "SURVEY";
  course_id: string;
  course_title: string;
  is_published?: boolean;
  responses?: number;
  responded?: boolean;
};
type Survey = {
  id: string;
  title: string;
  description: string;
  course_title: string;
  closes_at: string;
  questions: Array<{ id: string; prompt: string; position: number }>;
};
const labels: Record<string, string> = {
  EXAM: "Examen",
  PROJECT: "Proyecto",
  PRACTICE: "Práctica",
  QUIZ: "Quiz",
  SURVEY: "Encuesta",
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
        <button onClick={() => setMonth(new Date(year, m - 1, 1))}>
          <ChevronLeft />
        </button>
        <h2>
          {month.toLocaleDateString("es", { month: "long", year: "numeric" })}
        </h2>
        <button onClick={() => setMonth(new Date(year, m + 1, 1))}>
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
  const [events, setEvents] = useState<Event[]>([]);
  const [month, setMonth] = useState(new Date());
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const load = () =>
    api<Event[]>("/academic/student").then((r) => setEvents(r.data));
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
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
      setMessage("Encuesta enviada correctamente.");
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
          <p>Evaluaciones, proyectos y encuestas de tus cursos.</p>
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
            </article>
          ))}
        </aside>
      </div>
      {survey && (
        <div className="survey-modal">
          <form onSubmit={respond}>
            <header>
              <div>
                <span>ENCUESTA DEL CURSO</span>
                <h2>{survey.title}</h2>
                <p>{survey.course_title}</p>
              </div>
              <button type="button" onClick={() => setSurvey(null)}>
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
              Enviar encuesta
            </button>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
export function AcademicManagement() {
  const [events, setEvents] = useState<Event[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [month, setMonth] = useState(new Date());
  const [show, setShow] = useState<"EVALUATION" | "SURVEY" | null>(null);
  const [questions, setQuestions] = useState([""]);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [eventSearch, setEventSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<
    "ALL" | "EVALUATION" | "SURVEY"
  >("ALL");
  const load = () =>
    Promise.all([
      api<Event[]>("/academic/admin"),
      api<Course[]>("/courses/manage"),
    ]).then(([e, c]) => {
      setEvents(e.data);
      setCourses(c.data);
    });
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!show) return;
    const f = new FormData(e.currentTarget);
    setFormError("");
    setSubmitting(true);
    try {
      if (show === "EVALUATION")
        await api("/academic/evaluations", {
          method: "POST",
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
        await api("/academic/surveys", {
          method: "POST",
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
      setQuestions([""]);
      setMessage(
        show === "EVALUATION"
          ? "Evaluación creada y publicada."
          : "Encuesta creada y publicada.",
      );
      await load();
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };
  const publish = async (event: Event) => {
    try {
      await api(
        `/academic/${event.kind === "SURVEY" ? "survey" : "evaluation"}/${event.id}/publish`,
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
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };
  const openCreate = (kind: "EVALUATION" | "SURVEY") => {
    setFormError("");
    setQuestions([""]);
    setShow(kind);
  };
  const totals = useMemo(
    () => ({
      evaluations: events.filter((x) => x.kind === "EVALUATION").length,
      surveys: events.filter((x) => x.kind === "SURVEY").length,
      responses: events.reduce((s, x) => s + (x.responses ?? 0), 0),
    }),
    [events],
  );
  const visibleEvents = useMemo(() => {
    const term = eventSearch.trim().toLocaleLowerCase("es");
    return events.filter((event) => {
      const matchesType = eventFilter === "ALL" || event.kind === eventFilter;
      const matchesSearch =
        !term ||
        `${event.title} ${event.course_title} ${labels[event.type] ?? event.type}`
          .toLocaleLowerCase("es")
          .includes(term);
      return matchesType && matchesSearch;
    });
  }, [eventFilter, eventSearch, events]);
  return (
    <DashboardLayout>
      <div className="academic-management-view">
        <div className="academic-page-head admin">
          <div>
            <span>GESTIÓN ACADÉMICA</span>
            <h1>Calendario y evaluaciones</h1>
            <p>
              Programa actividades y recopila respuestas de tus estudiantes.
            </p>
          </div>
          <div>
          <button onClick={() => openCreate("SURVEY")} disabled={!courses.length}>
              <FileQuestion />
              Crear encuesta
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
                ["EVALUATION", "Evaluaciones"],
                ["SURVEY", "Encuestas"],
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
          <span>
            <strong>{visibleEvents.length}</strong> actividades visibles
          </span>
        </section>
        <div className="academic-kpis">
          <article>
            <ClipboardCheck />
            <span>
              <strong>{totals.evaluations}</strong>Evaluaciones
            </span>
          </article>
          <article>
            <FileQuestion />
            <span>
              <strong>{totals.surveys}</strong>Encuestas
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
              <span>{events.length}</span>
            </header>
            {visibleEvents.slice(0, 9).map((event) => (
              <article key={`${event.kind}-${event.id}`}>
                <div>
                  <i className={event.kind.toLowerCase()}>
                    {event.kind === "SURVEY" ? (
                      <FileQuestion />
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
                  </span>
                </div>
                <button
                  className="publish-toggle"
                  onClick={() => publish(event)}
                  title={event.is_published ? "Despublicar" : "Publicar"}
                >
                  {event.is_published ? <ToggleRight /> : <ToggleLeft />}
                </button>
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
          <form onSubmit={create}>
              <header>
                <div>
                  <span>
                    {show === "EVALUATION"
                      ? "NUEVA EVALUACIÓN"
                      : "NUEVA ENCUESTA"}
                  </span>
                  <h2>
                    {show === "EVALUATION"
                      ? "Programa una evaluación"
                      : "Crea una encuesta"}
                  </h2>
                </div>
                <button type="button" onClick={() => setShow(null)}>
                  <X />
                </button>
            </header>
            {formError && (
              <div className="academic-form-error">{formError}</div>
            )}
            <label>
                Curso
                <select name="courseId" required>
                  {courses.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Título
              <input name="title" required minLength={3} maxLength={180} />
              </label>
              <label>
                Descripción
                <textarea
                name="description"
                maxLength={1000}
                  placeholder="Indicaciones para los estudiantes"
                />
              </label>
              <div className="academic-form-row">
                {show === "EVALUATION" && (
                  <label>
                    Tipo
                    <select name="type">
                      <option value="EXAM">Examen</option>
                      <option value="QUIZ">Quiz</option>
                      <option value="PROJECT">Proyecto</option>
                      <option value="PRACTICE">Práctica</option>
                    </select>
                  </label>
                )}
                <label>
                  {show === "EVALUATION"
                    ? "Fecha límite"
                    : "Cierre de encuesta"}
                <input
                  name="date"
                  type="datetime-local"
                  required
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
                    .toISOString()
                    .slice(0, 16)}
                />
                </label>
              </div>
              {show === "SURVEY" && (
                <div className="question-builder">
                  <strong>Preguntas</strong>
                  {questions.map((q, i) => (
                    <div key={i}>
                      <span>{i + 1}</span>
                      <input
                        value={q}
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
                  disabled={questions.length >= 12}
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
                    onClick={() => setQuestions((items) => [...items, ""])}
                  >
                    <Plus />
                    Agregar pregunta
                  </button>
                </div>
              )}
            <button
              className="create-academic"
              type="submit"
              disabled={submitting}
            >
              <Check />
              {submitting ? "Creando actividad..." : "Crear y publicar"}
              </button>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
