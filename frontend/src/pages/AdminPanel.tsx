import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Landmark,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  UserCog,
  UserX,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../components/Layout";
import { api } from "../services/api";
type Stats = {
  students: number;
  courses: number;
  enrollments: number;
  completions: number;
  pending_payments: number;
  pending_submissions: number;
  approved_revenue: string | number;
};
type DashCourse = {
  id: string;
  title: string;
  instructor: string;
  level: string;
  students: number;
  progress: number;
};
type Audit = {
  id: number;
  action: string;
  actor_name: string | null;
  created_at: string;
};
type History = { label: string; completed: number };
type AdminData = {
  courses: DashCourse[];
  history: History[];
  activity: Audit[];
};
type GovernanceData = {
  summary: {
    total_users: number;
    active_users: number;
    inactive_users: number;
    admins: number;
    active_admins: number;
    super_admins: number;
    actions_today: number;
  };
  roles: Array<{ role: string; total: number; active: number }>;
  admin_activity: Array<
    Audit & { actor_email: string | null; actor_role: string | null }
  >;
  newest_users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
  }>;
};

const auditLabels: Record<string, string> = {
  MODULE_UPDATED: "actualizó un módulo",
  LESSON_UPDATED: "actualizó una lección",
  ASSIGNMENT_PUBLISHED: "publicó una tarea",
  ASSIGNMENT_UNPUBLISHED: "despublicó una tarea",
  EVALUATION_CREATED: "creó una evaluación",
  SURVEY_CREATED: "creó una encuesta",
  ACADEMIC_PUBLISHED: "publicó contenido académico",
  ACADEMIC_UNPUBLISHED: "despublicó contenido académico",
  COURSEWORK_SUBMITTED: "envió una actividad",
  QUESTIONNAIRE_SUBMITTED: "envió un cuestionario",
  PAYMENT_SUBMITTED: "registró un comprobante de pago",
  STUDENT_UPDATED: "actualizó el perfil de un estudiante",
  STUDENT_DEACTIVATED: "desactivó a un estudiante",
  COURSE_CREATED: "creó un nuevo curso",
  COURSE_UPDATED: "actualizó un curso",
  COURSE_PUBLISHED: "publicó un curso",
  COURSE_UNPUBLISHED: "despublicó un curso",
  ASSIGNMENT_CREATED: "creó una tarea",
  COURSEWORK_REVIEWED: "revisó una entrega",
  PAYMENT_APPROVED: "aprobó un pago",
  PAYMENT_REJECTED: "rechazó un pago",
  PAYMENT_DECISION_REVISED: "corrigió una decisión de pago",
  USER_ROLE_CHANGED: "cambió el rol de un usuario",
  USER_ACTIVATED: "activó una cuenta",
  USER_DEACTIVATED: "desactivó una cuenta",
  ADMIN_CREATED: "creó un administrador",
  PROFILE_UPDATED: "actualizó un perfil",
};

function auditLabel(action: string) {
  return auditLabels[action] ?? action.replaceAll("_", " ").toLowerCase();
}

function activityCategory(action: string) {
  if (action.includes("PAYMENT")) return "Pagos";
  if (
    action.includes("USER") ||
    action.includes("STUDENT") ||
    action.includes("ADMIN")
  )
    return "Usuarios";
  if (
    action.includes("ACADEMIC") ||
    action.includes("ASSIGNMENT") ||
    action.includes("EVALUATION") ||
    action.includes("SURVEY") ||
    action.includes("COURSEWORK") ||
    action.includes("QUESTIONNAIRE")
  )
    return "Académico";
  if (
    action.includes("COURSE") ||
    action.includes("MODULE") ||
    action.includes("LESSON")
  )
    return "Cursos";
  return "Sistema";
}

function activityPresentation(action: string) {
  if (action.includes("PAYMENT")) return { icon: Landmark, tone: "green" };
  if (
    action.includes("USER") ||
    action.includes("STUDENT") ||
    action.includes("ADMIN")
  )
    return { icon: Users, tone: "blue" };
  if (
    action.includes("ACADEMIC") ||
    action.includes("ASSIGNMENT") ||
    action.includes("EVALUATION") ||
    action.includes("SURVEY") ||
    action.includes("COURSEWORK") ||
    action.includes("QUESTIONNAIRE")
  )
    return { icon: ClipboardCheck, tone: "cyan" };
  if (
    action.includes("COURSE") ||
    action.includes("MODULE") ||
    action.includes("LESSON")
  )
    return { icon: BookOpen, tone: "violet" };
  return { icon: Activity, tone: "slate" };
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const days = Math.round(
    (startToday.getTime() - startDate.getTime()) / 86_400_000,
  );
  const time = date.toLocaleTimeString("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (days === 0) return `Hoy, ${time}`;
  if (days === 1) return `Ayer, ${time}`;
  return date.toLocaleDateString("es-BO", { day: "2-digit", month: "short" });
}
export function AdminDashboard({
  superAdmin = false,
}: {
  superAdmin?: boolean;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [data, setData] = useState<AdminData>({
    courses: [],
    history: [],
    activity: [],
  });
  const [governance, setGovernance] = useState<GovernanceData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      setLoadError("");
      try {
        const [statsResponse, dashboardResponse, governanceResponse] =
          await Promise.all([
            api<Stats>("/admin/stats", { signal: controller.signal }),
            api<AdminData>("/admin/dashboard", { signal: controller.signal }),
            superAdmin
              ? api<GovernanceData>("/admin/super-dashboard", {
                  signal: controller.signal,
                })
              : Promise.resolve(null),
          ]);
        if (!active) return;
        setStats(statsResponse.data);
        setData(dashboardResponse.data);
        if (governanceResponse) setGovernance(governanceResponse.data);
      } catch (error) {
        if (!active || (error as Error).name === "AbortError") return;
        setLoadError((error as Error).message);
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [reload, superAdmin]);
  const max = Math.max(...data.history.map((x) => x.completed), 1);
  const chart = data.history.map((x) =>
    Math.max(5, Math.round((x.completed * 100) / max)),
  );
  const cards = superAdmin
    ? [
        { icon: Users, value: governance?.summary.total_users ?? 0, label: "Usuarios totales", note: "Todas las cuentas", tone: "violet", to: "/super-admin/users" },
        { icon: UserCog, value: governance?.summary.active_admins ?? 0, label: "Administradores activos", note: "Equipo administrativo", tone: "blue", to: "/super-admin/users" },
        { icon: UserX, value: governance?.summary.inactive_users ?? 0, label: "Cuentas inactivas", note: "Requieren seguimiento", tone: "cyan", to: "/super-admin/users" },
        { icon: ShieldCheck, value: governance?.summary.actions_today ?? 0, label: "Acciones de hoy", note: "Auditoría administrativa", tone: "purple", to: "/super-admin" },
      ]
    : [
        { icon: BookOpen, value: stats?.courses ?? 0, label: "Cursos activos", note: "Oferta académica", tone: "violet", to: "/admin/courses" },
        { icon: Users, value: stats?.students ?? 0, label: "Estudiantes", note: "Cuentas registradas", tone: "blue", to: "/admin/students" },
        { icon: ClipboardCheck, value: stats?.pending_submissions ?? 0, label: "Entregas por revisar", note: "Bandeja académica", tone: "cyan", to: "/admin/submissions" },
        { icon: Landmark, value: stats?.pending_payments ?? 0, label: "Pagos por verificar", note: "Control financiero", tone: "purple", to: "/admin/payments" },
      ];
  const completionRate = stats?.enrollments
    ? Math.round((stats.completions / stats.enrollments) * 100)
    : 0;
  const activeAccountRate = governance?.summary.total_users
    ? Math.round(
        (governance.summary.active_users * 100) /
          governance.summary.total_users,
      )
    : 0;
  const displayedActivity = superAdmin
    ? (governance?.admin_activity ?? [])
    : data.activity;
  return (
    <DashboardLayout>
      <div className={`admin-overview ${superAdmin ? "is-super" : ""}`}>
        {loadError && (
          <div className="management-error" role="alert">
            {loadError}
            <button onClick={() => setReload((value) => value + 1)}>
              Reintentar
            </button>
          </div>
        )}
        <div className="academic-head">
          <div className="admin-title-block">
            <span className="admin-eyebrow">
              <Sparkles />
              {superAdmin ? "CONTROL GENERAL" : "GESTIÓN ACADÉMICA"}
            </span>
            <h1>
              {superAdmin ? "Panel de superadministración" : "Panel académico"}
            </h1>
            <p>
              {superAdmin
                ? "Supervisa accesos, administradores y actividad crítica del sistema."
                : "Controla cursos, entregas, estudiantes y tareas pendientes."}
            </p>
            <div className="admin-head-meta">
              <span><i /> Información en tiempo real</span>
              <span><CalendarDays />{new Date().toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric" })}</span>
            </div>
          </div>
          <div className="admin-head-actions">
            <Link className="academic-secondary" to="/admin/accounting">
              <Landmark />
              Contabilidad
            </Link>
            <Link
              className="academic-primary"
              to={superAdmin ? "/super-admin/users" : "/admin/courses"}
            >
              {superAdmin ? <UserCog /> : <Plus />}
              {superAdmin ? "Gestionar administradores" : "Nuevo curso"}
            </Link>
          </div>
        </div>
        <div className="academic-stats">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link className="admin-metric-card" to={card.to} key={card.label}>
                <i className={card.tone}>
                  <Icon />
                </i>
                <div>
                  <strong>{card.value}</strong>
                  <span>{card.label}</span>
                  <small>{card.note}</small>
                </div>
                <ArrowRight className="metric-arrow" />
              </Link>
            );
          })}
        </div>
        <div className="academic-grid">
          <section className="academic-card active-courses">
            <header>
              <div>
                <h2>Cursos activos</h2>
                <p>Rendimiento de la oferta publicada</p>
              </div>
              <Link to="/admin/courses">
                Ver los {stats?.courses ?? 0}
                <ArrowRight />
              </Link>
            </header>
            <div className="admin-course-list">
              {data.courses.slice(0, 4).map((course, i) => (
                <article
                  className={`admin-course-item course-tone-${i % 4}`}
                  key={course.id}
                >
                  <div className="admin-course-identity">
                    <i className={`course-symbol tone-${i % 4}`}>
                      <BookOpen />
                    </i>
                    <div className="admin-course-copy">
                      <strong>{course.title}</strong>
                      <span>
                        <b>{course.students}</b>{" "}
                        {course.students === 1 ? "estudiante" : "estudiantes"}
                        <i />
                        {course.instructor}
                      </span>
                    </div>
                  </div>
                  <div className="admin-course-progress">
                    <div>
                      <span>Progreso</span>
                      <strong>{course.progress}%</strong>
                    </div>
                    <div className="admin-course-bar">
                      <i style={{ width: `${course.progress}%` }} />
                    </div>
                  </div>
                  <Link
                    className="course-edit-shortcut"
                    to={`/admin/course-editor?course=${course.id}`}
                    aria-label={`Editar ${course.title}`}
                    title="Editar contenido"
                  >
                    <Pencil />
                  </Link>
                </article>
              ))}
              {!data.courses.length && (
                <div className="academic-empty">
                  <BookOpen />
                  <span>No hay cursos publicados.</span>
                </div>
              )}
            </div>
          </section>
          <section className="academic-card progress-chart">
            <header>
              <div>
                <h2>Progreso</h2>
                <p>Lecciones completadas por mes</p>
              </div>
            </header>
            <div className="chart-area">
              <div className="chart-y">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0%</span>
              </div>
              <div className="chart-plot">
                <div className="chart-lines">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                {chart.length > 0 && (
                  <svg viewBox="0 0 500 190" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="adminChartArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#633df0" stopOpacity=".22" />
                        <stop offset="1" stopColor="#633df0" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={`M${chart.map((v, i) => `${i * 100},${190 - v * 1.65}`).join(" L")} L500,190 L0,190 Z`}
                      fill="url(#adminChartArea)"
                    />
                    <polyline
                      points={chart
                        .map((v, i) => `${i * 100},${190 - v * 1.65}`)
                        .join(" ")}
                      fill="none"
                      stroke="#633df0"
                      strokeWidth="4"
                    />
                    {chart.map((v, i) => (
                      <circle
                        key={i}
                        cx={i * 100}
                        cy={190 - v * 1.65}
                        r="6"
                        fill="#fff"
                        stroke="#633df0"
                        strokeWidth="4"
                      />
                    ))}
                  </svg>
                )}
                <div className="chart-x">
                  {data.history.map((x) => (
                    <span key={x.label}>{x.label}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <section className="academic-card admin-summary">
            <header>
              <h2>{superAdmin ? "Gobierno de acceso" : "Resumen académico"}</h2>
            </header>
            <div
              className="summary-ring"
              style={
                {
                  "--summary-progress": `${(superAdmin ? activeAccountRate : completionRate) * 3.6}deg`,
                } as React.CSSProperties
              }
            >
              <div>
                <strong>
                  {superAdmin ? activeAccountRate : completionRate}%
                </strong>
                <span>{superAdmin ? "cuentas activas" : "finalización"}</span>
              </div>
            </div>
            {superAdmin ? (
              <ul>
                {governance?.roles.map((role, index) => (
                  <li key={role.role}>
                    <i className={["green", "blue", "violet"][index % 3]} />
                    <span>{role.role.replace("_", " ")}</span>
                    <strong>{role.active}/{role.total}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <ul>
                <li><i className="green" /><span>Estudiantes</span><strong>{stats?.students ?? 0}</strong></li>
                <li><i className="blue" /><span>Inscripciones</span><strong>{stats?.enrollments ?? 0}</strong></li>
                <li><i className="violet" /><span>Finalizaciones</span><strong>{stats?.completions ?? 0}</strong></li>
              </ul>
            )}
          </section>
          <section className="academic-card recent-activity">
            <header>
              <div>
                <h2>
                  {superAdmin ? "Actividad administrativa" : "Actividad reciente"}
                </h2>
                <p>Últimos movimientos registrados en la plataforma</p>
              </div>
              <span className="activity-live"><i /> En vivo</span>
            </header>
            <div className="recent-activity-list">
              {displayedActivity.length ? (
                displayedActivity.slice(0, 4).map((x) => {
                  const presentation = activityPresentation(x.action);
                  const ActivityIcon = presentation.icon;
                  return (
                    <article className="recent-activity-item" key={x.id}>
                      <i className={`activity-icon ${presentation.tone}`}>
                        <ActivityIcon />
                      </i>
                      <div className="activity-copy">
                        <p>
                          <strong>{x.actor_name ?? "Sistema"}</strong>
                          <span>{auditLabel(x.action)}</span>
                        </p>
                        <div>
                          <small>{activityCategory(x.action)}</small>
                          <time>{formatActivityDate(x.created_at)}</time>
                        </div>
                      </div>
                      <span
                        className="activity-status"
                        aria-label="Actividad registrada"
                      />
                    </article>
                  );
                })
              ) : (
                <div className="academic-empty">Sin actividad registrada.</div>
              )}
            </div>
          </section>
          <section className="academic-card quick-actions">
            <header>
              <h2>Acciones rápidas</h2>
            </header>
            <div>
              <Link to="/admin/courses">
                <BookOpen />
                <span><strong>Gestionar cursos</strong><small>Contenido y publicación</small></span>
                <ArrowRight />
              </Link>
              <Link to="/admin/students">
                <Users />
                <span><strong>Ver estudiantes</strong><small>Perfiles e inscripciones</small></span>
                <ArrowRight />
              </Link>
              <Link to="/admin/accounting">
                <Landmark />
                <span><strong>Ver contabilidad</strong><small>Ingresos y movimientos</small></span>
                <ArrowRight />
              </Link>
              {superAdmin && (
                <Link to="/super-admin/users">
                  <ShieldCheck />
                  <span><strong>Usuarios y roles</strong><small>Accesos administrativos</small></span>
                  <ArrowRight />
                </Link>
              )}
              <Link to="/admin/submissions">
                <FileText />
                <span><strong>Revisar entregas</strong><small>Tareas y evaluaciones</small></span>
                <ArrowRight />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
