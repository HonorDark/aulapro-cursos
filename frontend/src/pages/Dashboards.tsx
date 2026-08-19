import {
  Activity,
  AlertTriangle,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  FileQuestion,
  FolderOpen,
  ExternalLink,
  Info,
  ListChecks,
  Play,
  Plus,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import type { Course, Lesson, Module } from "../types";
import {
  courseworkKindLabels,
  courseworkStatusLabels,
  type CourseworkKind,
  type CourseworkStatus,
} from "../features/coursework/types";

function CourseActivityIcon({ kind }: { kind: CourseworkKind }) {
  if (kind === "ASSIGNMENT") return <ListChecks />;
  if (kind === "QUESTIONNAIRE") return <FileQuestion />;
  return <FileText />;
}
type Enrollment = {
  id: string;
  course_id: string;
  title: string;
  slug: string;
  image_url: string;
  instructor: string;
  lesson_count: number;
  completed_count: number;
  progress: number;
};
export function StudentDashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState<Enrollment[]>([]);
  useEffect(() => {
    api<Enrollment[]>("/enrollments/me").then((r) => setItems(r.data));
  }, []);
  const avg = items.length
    ? Math.round(items.reduce((a, c) => a + c.progress, 0) / items.length)
    : 0;
  return (
    <DashboardLayout>
      <PageTitle
        eyebrow="Mi aprendizaje"
        title={`Hola, ${user?.name.split(" ")[0]} 👋`}
        text="Cada lección te acerca a tu siguiente meta."
      />
      <div className="stats">
        <Stat icon={<BookOpen />} value={items.length} label="Cursos activos" />
        <Stat
          icon={<TrendingUp />}
          value={`${avg}%`}
          label="Progreso general"
        />
        <Stat
          icon={<CheckCircle2 />}
          value={items.filter((i) => i.progress === 100).length}
          label="Completados"
        />
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Continúa aprendiendo</h2>
          <Link to="/courses">Explorar más</Link>
        </div>
        {items.length ? (
          items.map((item) => (
            <div className="learning-row" key={item.id}>
              <img src={item.image_url} alt="" />
              <div>
                <h3>{item.title}</h3>
                <p>{item.instructor}</p>
                <div className="progress">
                  <i style={{ width: `${item.progress}%` }} />
                </div>
                <small>
                  {item.progress}% · {item.completed_count} de{" "}
                  {item.lesson_count} lecciones
                </small>
              </div>
              <Link
                className="button small"
                to={`/classroom/${item.course_id}`}
              >
                Continuar
              </Link>
            </div>
          ))
        ) : (
          <Empty text="Todavía no tienes cursos. Explora el catálogo y comienza hoy." />
        )}
      </section>
    </DashboardLayout>
  );
}
type Classroom = {
  enrollment_id: string;
  id: string;
  title: string;
  description: string;
  instructor: string;
  image_url: string | null;
  level: string;
  duration_minutes: number;
  modules: Module[];
};
type CourseOverview = {
  modality: string;
  activities: Array<{
    id: string;
    kind: "ASSIGNMENT" | "EVALUATION" | "QUESTIONNAIRE";
    title: string;
    type: string;
    description: string | null;
    due_at: string;
    max_score: string | number | null;
    status:
      | "NOT_SUBMITTED"
      | "SUBMITTED"
      | "CHANGES_REQUESTED"
      | "GRADED"
      | "VERIFIED";
    score: string | number | null;
    feedback: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
    is_overdue: boolean;
  }>;
  resources: Array<{
    id: string;
    title: string;
    description: string | null;
    resource_type: "LINK" | "PDF" | "VIDEO" | "FILE";
    url: string;
  }>;
  recent: Array<{
    id: string;
    kind: "LESSON" | "ASSIGNMENT" | "EVALUATION" | "QUESTIONNAIRE";
    status: string;
    title: string;
    detail: string;
    happened_at: string;
  }>;
  grades: Array<{
    id: string;
    kind: "ASSIGNMENT" | "EVALUATION";
    title: string;
    score: string | number;
    max_score: string | number;
    feedback: string | null;
    reviewed_at: string;
  }>;
};
export function Classroom() {
  const { courseId } = useParams();
  const [data, setData] = useState<Classroom | null>(null);
  const [overview, setOverview] = useState<CourseOverview>({
    modality: "ONLINE",
    activities: [],
    resources: [],
    recent: [],
    grades: [],
  });
  const [loadError, setLoadError] = useState("");
  const [active, setActive] = useState<Lesson | null>(null);
  const [activeTab, setActiveTab] = useState<
    "CONTENT" | "INFO" | "ACTIVITIES" | "RESOURCES" | "GRADES"
  >("CONTENT");
  const [expanded, setExpanded] = useState<number[]>([1]);
  const load = useCallback(
    () =>
      Promise.all([
        api<Classroom>(`/enrollments/${courseId}/classroom`),
        api<CourseOverview>(`/coursework/student/course/${courseId}`),
      ]).then(([course, extra]) => {
        setData(course.data);
        setOverview(extra.data);
        setActive((current) =>
          current
            ? (course.data.modules
                .flatMap((m) => m.lessons)
                .find((l) => l.id === current.id) ?? current)
            : null,
        );
      }),
    [courseId],
  );
  useEffect(() => {
    setLoadError("");
    void load().catch((error: Error) => setLoadError(error.message));
  }, [load]);
  const lessons = useMemo(
    () => data?.modules.flatMap((m) => m.lessons) ?? [],
    [data],
  );
  const done = lessons.filter((l) => l.completed).length;
  const progress = Math.round((done * 100) / Math.max(lessons.length, 1));
  const completedModules =
    data?.modules.filter(
      (m) => m.lessons.length > 0 && m.lessons.every((l) => l.completed),
    ).length ?? 0;
  const invested = lessons
    .filter((l) => l.completed)
    .reduce((sum, l) => sum + l.duration_minutes, 0);
  const upcomingActivities = useMemo(
    () =>
      overview.activities.filter(
        (item) =>
          new Date(item.due_at) >= new Date() &&
          !["GRADED", "VERIFIED"].includes(item.status),
      ),
    [overview.activities],
  );
  const toggle = async () => {
    if (!active) return;
    await api(`/progress/${active.id}`, {
      method: "PUT",
      body: JSON.stringify({ completed: !active.completed }),
    });
    await load();
  };
  const openModule = (position: number) =>
    setExpanded((items) =>
      items.includes(position)
        ? items.filter((x) => x !== position)
        : [...items, position],
    );
  if (!data && loadError)
    return (
      <DashboardLayout>
        <div className="page-state course-load-error">
          <AlertTriangle />
          <h2>No pudimos abrir este curso</h2>
          <p>{loadError}</p>
          <Link to="/student">Volver a mis cursos</Link>
        </div>
      </DashboardLayout>
    );
  if (!data)
    return (
      <DashboardLayout>
        <div className="page-state">Cargando aula…</div>
      </DashboardLayout>
    );
  return (
    <DashboardLayout>
      <div className="course-overview">
        <Link className="course-back" to="/student">
          <ChevronLeft />
          Mis cursos
        </Link>
        <div className="course-overview-grid">
          <main>
            <section className="course-intro">
              {data.image_url ? (
                <img src={data.image_url} alt={`Portada de ${data.title}`} />
              ) : (
                <div className="course-cover-fallback"><BookOpen /></div>
              )}
              <div>
                <span>CURSO EN PROGRESO</span>
                <h1>{data.title}</h1>
                <p>{data.description}</p>
                <dl>
                  <div>
                    <Users />
                    <dt>
                      Profesor<dd>{data.instructor}</dd>
                    </dt>
                  </div>
                  <div>
                    <TrendingUp />
                    <dt>
                      Nivel
                      <dd>
                        {data.level === "BEGINNER"
                          ? "Básico"
                          : data.level === "INTERMEDIATE"
                            ? "Intermedio"
                            : "Avanzado"}
                      </dd>
                    </dt>
                  </div>
                  <div>
                    <Clock3 />
                    <dt>
                      Duración
                      <dd>
                        {Math.max(1, Math.round(data.duration_minutes / 60))}{" "}
                        horas
                      </dd>
                    </dt>
                  </div>
                  <div>
                    <BookOpen />
                    <dt>
                      Modalidad
                      <dd>
                        {overview.modality === "HYBRID"
                          ? "Híbrida"
                          : overview.modality === "IN_PERSON"
                            ? "Presencial"
                            : "En línea"}
                      </dd>
                    </dt>
                  </div>
                </dl>
              </div>
            </section>
            <nav className="course-tabs">
              {(
                [
                  ["CONTENT", "Contenido"],
                  ["INFO", "Información"],
                  ["ACTIVITIES", `Actividades (${overview.activities.length})`],
                  ["RESOURCES", `Recursos (${overview.resources.length})`],
                  ["GRADES", `Calificaciones (${overview.grades.length})`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={activeTab === value ? "active" : ""}
                  onClick={() => setActiveTab(value)}
                >
                  {label}
                </button>
              ))}
            </nav>
            {activeTab === "CONTENT" && (
              <>
            <section className="course-content-head">
              <div>
                <h2>Contenido del curso</h2>
                <p>
                  {data.modules.length} módulos · {lessons.length} lecciones
                </p>
              </div>
              <div>
                <button
                  onClick={() =>
                    setExpanded(data.modules.map((m) => m.position))
                  }
                >
                  Expandir todo
                </button>
                <button onClick={() => setExpanded([])}>Contraer todo</button>
              </div>
            </section>
            <div className="overview-modules">
              {data.modules.map((module, moduleIndex) => {
                const moduleDone = module.lessons.filter(
                  (l) => l.completed,
                ).length;
                const percent = Math.round(
                  (moduleDone * 100) / Math.max(module.lessons.length, 1),
                );
                const isOpen = expanded.includes(module.position);
                return (
                  <article className={isOpen ? "open" : ""} key={module.id}>
                    <button
                      className="module-summary"
                      onClick={() => openModule(module.position)}
                    >
                      <i className={`module-tone tone-${moduleIndex % 4}`}>
                        {module.position}
                      </i>
                      <span>
                        <strong>{module.title}</strong>
                        <small>{module.lessons.length} lecciones</small>
                      </span>
                      <b>{percent}%</b>
                      <em>
                        <span style={{ width: `${percent}%` }} />
                      </em>
                      <ChevronDown />
                    </button>
                    {isOpen && (
                      <div className="overview-lessons">
                        {module.lessons.map((lesson, lessonIndex) => (
                          <button
                            key={lesson.id}
                            onClick={() => setActive(lesson)}
                          >
                            <i className={lesson.completed ? "completed" : ""}>
                              {lesson.completed ? <CheckCircle2 /> : <Play />}
                            </i>
                            <span>
                              <strong>
                                {module.position}.{lessonIndex + 1}{" "}
                                {lesson.title}
                              </strong>
                              <small>{lesson.duration_minutes} minutos</small>
                            </span>
                            {lesson.completed ? (
                              <b>Completada</b>
                            ) : (
                              <ChevronRight />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
              </>
            )}
            {activeTab === "INFO" && (
              <section className="course-tab-panel course-information-panel">
                <header>
                  <i><Info /></i>
                  <div>
                    <span>ACERCA DEL CURSO</span>
                    <h2>{data.title}</h2>
                  </div>
                </header>
                <p>{data.description}</p>
                <div className="course-facts">
                  <article><Users /><span><small>Instructor</small><strong>{data.instructor}</strong></span></article>
                  <article><TrendingUp /><span><small>Nivel</small><strong>{data.level === "BEGINNER" ? "Básico" : data.level === "INTERMEDIATE" ? "Intermedio" : "Avanzado"}</strong></span></article>
                  <article><BookOpen /><span><small>Estructura</small><strong>{data.modules.length} módulos · {lessons.length} lecciones</strong></span></article>
                  <article><Clock3 /><span><small>Duración estimada</small><strong>{Math.floor(data.duration_minutes / 60)}h {data.duration_minutes % 60}m</strong></span></article>
                </div>
              </section>
            )}
            {activeTab === "ACTIVITIES" && (
              <section className="course-tab-panel">
                <div className="course-tab-heading">
                  <div><span>TRABAJO DEL CURSO</span><h2>Tareas, evaluaciones y cuestionarios</h2></div>
                  <Link to={`/student/tasks?course=${data.id}`}>Abrir espacio de entregas <ChevronRight /></Link>
                </div>
                <div className="course-activities-list">
                  {overview.activities.map((item) => (
                    <article key={`${item.kind}-${item.id}`}>
                      <i className={item.kind.toLowerCase()}><CourseActivityIcon kind={item.kind} /></i>
                      <div>
                        <span>{courseworkKindLabels[item.kind]}</span>
                        <h3>{item.title}</h3>
                        <p>{item.description || "Consulta las indicaciones en el espacio de entregas."}</p>
                      </div>
                      <time><CalendarDays /><span><small>Fecha límite</small><strong>{new Date(item.due_at).toLocaleDateString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</strong></span></time>
                      <b className={`coursework-status ${item.status.toLowerCase()}`}>{courseworkStatusLabels[item.status as CourseworkStatus]}</b>
                      <Link to={`/student/tasks?course=${data.id}`}>{item.status === "NOT_SUBMITTED" ? "Realizar" : "Ver entrega"}</Link>
                    </article>
                  ))}
                  {!overview.activities.length && <div className="course-tab-empty"><ListChecks /><strong>Aún no hay actividades publicadas</strong><span>Las tareas y evaluaciones de este curso aparecerán aquí.</span></div>}
                </div>
              </section>
            )}
            {activeTab === "RESOURCES" && (
              <section className="course-tab-panel">
                <div className="course-tab-heading"><div><span>BIBLIOTECA DEL CURSO</span><h2>Recursos publicados</h2></div></div>
                <div className="course-resources-list">
                  {overview.resources.map((resource) => (
                    <a href={resource.url} target="_blank" rel="noreferrer" key={resource.id}>
                      <i><FolderOpen /></i>
                      <span><small>{resource.resource_type}</small><strong>{resource.title}</strong><p>{resource.description}</p></span>
                      <ExternalLink />
                    </a>
                  ))}
                  {!overview.resources.length && <div className="course-tab-empty"><FolderOpen /><strong>No hay recursos publicados</strong><span>El material adicional del curso aparecerá aquí.</span></div>}
                </div>
              </section>
            )}
            {activeTab === "GRADES" && (
              <section className="course-tab-panel">
                <div className="course-tab-heading"><div><span>RESULTADOS</span><h2>Mis calificaciones</h2></div></div>
                <div className="course-grades-list">
                  {overview.grades.map((grade) => {
                    const percentage = Math.round((Number(grade.score) * 100) / Math.max(Number(grade.max_score), 1));
                    return <article key={`${grade.kind}-${grade.id}`}><i><Award /></i><div><span>{grade.kind === "ASSIGNMENT" ? "Tarea" : "Evaluación"}</span><h3>{grade.title}</h3>{grade.feedback && <p>{grade.feedback}</p>}</div><strong>{grade.score}<small>/ {grade.max_score}</small></strong><em><span style={{ width: `${Math.min(percentage, 100)}%` }} /></em></article>;
                  })}
                  {!overview.grades.length && <div className="course-tab-empty"><Award /><strong>Todavía no tienes calificaciones</strong><span>Los resultados aparecerán después de la revisión administrativa.</span></div>}
                </div>
              </section>
            )}
          </main>
          <aside className="course-insights">
            <section className="course-progress-card">
              <h2>Progreso del curso</h2>
              <div className="progress-detail">
                <div
                  className="progress-ring"
                  style={
                    {
                      "--course-progress": `${progress * 3.6}deg`,
                    } as React.CSSProperties
                  }
                >
                  <strong>{progress}%</strong>
                  <span>completado</span>
                </div>
                <dl>
                  <div>
                    <dt>Módulos</dt>
                    <dd>
                      {completedModules}/{data.modules.length}
                    </dd>
                  </div>
                  <div>
                    <dt>Lecciones</dt>
                    <dd>
                      {done}/{lessons.length}
                    </dd>
                  </div>
                  <div>
                    <dt>Tiempo invertido</dt>
                    <dd>
                      {Math.floor(invested / 60)}h {invested % 60}m
                    </dd>
                  </div>
                </dl>
              </div>
              <button
                onClick={() =>
                  setActive(
                    lessons.find((l) => !l.completed) ?? lessons[0] ?? null,
                  )
                }
              >
                <Play />
                Continuar aprendiendo
              </button>
            </section>
            <section className="course-side-card">
              <header>
                <h2>Próximas actividades</h2>
                <CalendarDays />
              </header>
              {upcomingActivities.length ? (
                upcomingActivities.slice(0, 4).map((item) => {
                  const date = new Date(item.due_at);
                  return (
                    <article key={`${item.kind}-${item.id}`}>
                      <i className={item.kind.toLowerCase()}>
                        <CourseActivityIcon kind={item.kind} />
                      </i>
                      <div>
                        <strong>{item.title}</strong>
                        <span>
                          {courseworkKindLabels[item.kind]} ·{" "}
                          {date.toLocaleDateString("es", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="side-empty">No hay actividades próximas.</p>
              )}
              {upcomingActivities.length > 0 && (
                <Link className="course-side-link" to={`/student/tasks?course=${data.id}`}>Ver todas las actividades <ChevronRight /></Link>
              )}
            </section>
            <section className="course-side-card">
              <header>
                <h2>Actividad reciente</h2>
                <Activity />
              </header>
              {overview.recent.length ? (
                overview.recent.slice(0, 5).map((item) => (
                  <article key={`${item.kind}-${item.id}`}>
                    <i className="activity">
                      {item.kind === "LESSON" ? <CheckCircle2 /> : <Activity />}
                    </i>
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {item.detail} ·{" "}
                        {new Date(item.happened_at).toLocaleDateString("es")}
                      </span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="side-empty">
                  Completa una lección para iniciar tu actividad.
                </p>
              )}
            </section>
          </aside>
        </div>
        {active && (
          <div className="lesson-player-modal">
            <section>
              <header>
                <div>
                  <span>LECCIÓN DEL CURSO</span>
                  <h2>{active.title}</h2>
                </div>
                <button onClick={() => setActive(null)}>
                  <X />
                </button>
              </header>
              <div className="video">
                <iframe
                  src={active.video_url ?? ""}
                  title={active.title}
                  allowFullScreen
                />
              </div>
              <p>{active.content}</p>
              <footer>
                <button
                  className={active.completed ? "completed" : ""}
                  onClick={toggle}
                >
                  <CheckCircle2 />
                  {active.completed
                    ? "Marcar como pendiente"
                    : "Marcar como completada"}
                </button>
                <button onClick={() => setActive(null)}>Cerrar lección</button>
              </footer>
            </section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
const PageTitle = ({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) => (
  <div className="page-title">
    <span className="eyebrow">{eyebrow}</span>
    <h1>{title}</h1>
    <p>{text}</p>
  </div>
);
const Stat = ({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) => (
  <div className="stat">
    <span>{icon}</span>
    <div>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  </div>
);
const Empty = ({ text }: { text: string }) => (
  <div className="empty">
    <BookOpen />
    <p>{text}</p>
  </div>
);
type Stats = {
  students: number;
  courses: number;
  enrollments: number;
  completions: number;
};
export function AdminDashboard({
  superAdmin = false,
}: {
  superAdmin?: boolean;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<
    { id: number; action: string; actor_name: string; created_at: string }[]
  >([]);
  useEffect(() => {
    api<Stats>("/admin/stats").then((r) => setStats(r.data));
    if (superAdmin)
      api<typeof activity>("/admin/activity").then((r) => setActivity(r.data));
  }, [superAdmin]);
  return (
    <DashboardLayout>
      <PageTitle
        eyebrow={superAdmin ? "Control total" : "Administración"}
        title={
          superAdmin ? "Panel de superadministración" : "Panel administrativo"
        }
        text={
          superAdmin
            ? "Gestiona personas, permisos y actividad del sistema."
            : "Consulta el rendimiento y gestiona la oferta académica."
        }
      />
      <div className="stats">
        <Stat
          icon={<Users />}
          value={stats?.students ?? "—"}
          label="Estudiantes"
        />
        <Stat
          icon={<BookOpen />}
          value={stats?.courses ?? "—"}
          label="Cursos"
        />
        <Stat
          icon={<TrendingUp />}
          value={stats?.enrollments ?? "—"}
          label="Inscripciones"
        />
        <Stat
          icon={<CheckCircle2 />}
          value={stats?.completions ?? "—"}
          label="Finalizaciones"
        />
      </div>
      {superAdmin ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Actividad administrativa</h2>
            <Activity />
          </div>
          {activity.length ? (
            activity.slice(0, 8).map((a) => (
              <div className="activity-row" key={a.id}>
                <ShieldCheck />
                <div>
                  <strong>{a.actor_name ?? "Sistema"}</strong>
                  <p>{a.action.replaceAll("_", " ").toLowerCase()}</p>
                </div>
                <time>{new Date(a.created_at).toLocaleDateString()}</time>
              </div>
            ))
          ) : (
            <Empty text="Aún no hay actividad registrada." />
          )}
        </section>
      ) : (
        <section className="admin-grid">
          <Link to="/admin/courses">
            <BookOpen />
            <h2>Gestionar cursos</h2>
            <p>Crea, edita y controla la publicación.</p>
          </Link>
          <Link to="/admin/students">
            <Users />
            <h2>Ver estudiantes</h2>
            <p>Consulta estudiantes e inscripciones.</p>
          </Link>
        </section>
      )}
    </DashboardLayout>
  );
}
export function CoursesAdmin() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const load = () =>
    api<Course[]>("/courses/manage").then((r) => setCourses(r.data));
  useEffect(() => {
    load();
  }, []);
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api("/courses", {
        method: "POST",
        body: JSON.stringify({
          title: f.get("title"),
          slug: f.get("slug"),
          description: f.get("description"),
          instructor: f.get("instructor"),
          level: f.get("level"),
          price: Number(f.get("price")),
          durationMinutes: Number(f.get("duration")),
          isPublished: false,
        }),
      });
      setShow(false);
      setMessage("Curso creado como borrador.");
      load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  };
  const publish = async (c: Course) => {
    await api(`/courses/${c.id}/publish`, {
      method: "PATCH",
      body: JSON.stringify({ isPublished: !c.is_published }),
    });
    load();
  };
  return (
    <DashboardLayout>
      <div className="page-title actions">
        <div>
          <span className="eyebrow">Contenido</span>
          <h1>Cursos</h1>
          <p>Crea y publica la oferta académica.</p>
        </div>
        <button className="button" onClick={() => setShow(true)}>
          <Plus />
          Nuevo curso
        </button>
      </div>
      {message && <div className="alert">{message}</div>}
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Curso</th>
              <th>Nivel</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.title}</strong>
                  <small>{c.instructor}</small>
                </td>
                <td>{c.level}</td>
                <td>${c.price}</td>
                <td>
                  <span className={c.is_published ? "badge live" : "badge"}>
                    {c.is_published ? "Publicado" : "Borrador"}
                  </span>
                </td>
                <td>
                  <button className="table-action" onClick={() => publish(c)}>
                    {c.is_published ? <EyeOff /> : <Eye />}
                    {c.is_published ? "Despublicar" : "Publicar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {show && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={create}>
            <div className="panel-head">
              <h2>Nuevo curso</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShow(false)}
              >
                ×
              </button>
            </div>
            <label>
              Título
              <input name="title" required minLength={3} />
            </label>
            <label>
              Slug
              <input name="slug" required pattern="[a-z0-9-]+" />
            </label>
            <label>
              Descripción
              <textarea name="description" required minLength={10} />
            </label>
            <div className="form-grid">
              <label>
                Instructor
                <input name="instructor" required />
              </label>
              <label>
                Nivel
                <select name="level">
                  <option value="BEGINNER">Inicial</option>
                  <option value="INTERMEDIATE">Intermedio</option>
                  <option value="ADVANCED">Avanzado</option>
                </select>
              </label>
              <label>
                Precio
                <input name="price" type="number" min="0" defaultValue="0" />
              </label>
              <label>
                Duración (min)
                <input
                  name="duration"
                  type="number"
                  min="0"
                  defaultValue="60"
                />
              </label>
            </div>
            <button className="button full">Crear borrador</button>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
