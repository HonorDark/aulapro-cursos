import {
  Activity,
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  FileText,
  Plus,
  ShieldCheck,
  TrendingUp,
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
  useEffect(() => {
    Promise.all([
      api<Stats>("/admin/stats"),
      api<AdminData>("/admin/dashboard"),
    ]).then(([s, d]) => {
      setStats(s.data);
      setData(d.data);
    });
  }, []);
  const max = Math.max(...data.history.map((x) => x.completed), 1);
  const chart = data.history.map((x) =>
    Math.max(5, Math.round((x.completed * 100) / max)),
  );
  const cards = [
    [BookOpen, stats?.courses ?? 0, "Cursos activos", "Oferta académica"],
    [Users, stats?.students ?? 0, "Estudiantes", "Cuentas registradas"],
    [
      TrendingUp,
      stats?.enrollments ?? 0,
      "Inscripciones",
      "Participación total",
    ],
    [
      ClipboardCheck,
      stats?.completions ?? 0,
      "Finalizaciones",
      "Cursos completados",
    ],
  ];
  return (
    <DashboardLayout>
      <div className={`admin-overview ${superAdmin ? "is-super" : ""}`}>
        <div className="academic-head">
          <div>
            <h1>
              {superAdmin ? "Panel de superadministración" : "Panel académico"}
            </h1>
            <p>Resumen conectado de la actividad de AulaFlow.</p>
          </div>
          <div>
            <Link className="academic-primary" to="/admin/courses">
              <Plus />
              Nuevo curso
            </Link>
          </div>
        </div>
        <div className="academic-stats">
          {cards.map(([Icon, value, label, note], i) => {
            const C = Icon as typeof BookOpen;
            return (
              <article key={String(label)}>
                <i className={["violet", "blue", "cyan", "purple"][i]}>
                  <C />
                </i>
                <div>
                  <strong>{String(value)}</strong>
                  <span>{String(label)}</span>
                  <small>{String(note)}</small>
                </div>
              </article>
            );
          })}
        </div>
        <div className="academic-grid">
          <section className="academic-card active-courses">
            <header>
              <h2>Cursos activos</h2>
              <Link to="/admin/courses">Ver todos</Link>
            </header>
            <div>
              {data.courses.slice(0, 4).map((course, i) => (
                <article key={course.id}>
                  <i className={`course-symbol tone-${i % 4}`}>
                    <BookOpen />
                  </i>
                  <div>
                    <strong>{course.title}</strong>
                    <span>
                      {course.students} estudiantes · {course.instructor}
                    </span>
                  </div>
                  <div className="mini-course-progress">
                    <i style={{ width: `${course.progress}%` }} />
                    <small>{course.progress}%</small>
                  </div>
                  <button>•••</button>
                </article>
              ))}
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
              <h2>Resumen del sistema</h2>
            </header>
            <div className="summary-ring">
              <div>
                <strong>
                  {stats?.enrollments
                    ? Math.round((stats.completions / stats.enrollments) * 100)
                    : 0}
                  %
                </strong>
                <span>finalización</span>
              </div>
            </div>
            <ul>
              <li>
                <i className="green" />
                <span>Estudiantes</span>
                <strong>{stats?.students ?? 0}</strong>
              </li>
              <li>
                <i className="blue" />
                <span>Inscripciones</span>
                <strong>{stats?.enrollments ?? 0}</strong>
              </li>
              <li>
                <i className="violet" />
                <span>Finalizaciones</span>
                <strong>{stats?.completions ?? 0}</strong>
              </li>
            </ul>
          </section>
          <section className="academic-card recent-activity">
            <header>
              <h2>Actividad reciente</h2>
            </header>
            <div>
              {data.activity.length ? (
                data.activity.slice(0, 4).map((x, i) => (
                  <article key={x.id}>
                    <i className={`activity-tone-${i % 4}`}>
                      <Activity />
                    </i>
                    <p>
                      <strong>{x.actor_name ?? "Sistema"}</strong>{" "}
                      {x.action.replaceAll("_", " ").toLowerCase()}
                    </p>
                    <time>
                      {new Date(x.created_at).toLocaleDateString("es")}
                    </time>
                    <b />
                  </article>
                ))
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
                Gestionar cursos
                <ArrowRight />
              </Link>
              <Link to="/admin/students">
                <Users />
                Ver estudiantes
                <ArrowRight />
              </Link>
              {superAdmin && (
                <Link to="/super-admin/users">
                  <ShieldCheck />
                  Usuarios y roles
                  <ArrowRight />
                </Link>
              )}
              <a href="mailto:soporte@aulaflow.test">
                <FileText />
                Solicitar reporte
                <ArrowRight />
              </a>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
