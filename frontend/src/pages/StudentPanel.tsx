import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Compass,
  ListChecks,
  Play,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
type Enrollment = {
  id: string;
  course_id: string;
  title: string;
  image_url: string;
  instructor: string;
  lesson_count: number;
  completed_count: number;
  progress: number;
};
type Evaluation = {
  id: string;
  title: string;
  type: string;
  due_at: string;
  course_title: string;
  status: string;
};
type StudentActivity = {
  id: string;
  completed_at: string;
  course_title: string;
  lesson_title: string;
};
type History = { label: string; completed: number };
type DashboardData = {
  evaluations: Evaluation[];
  activities: Array<{
    id: string;
    kind: "ASSIGNMENT" | "EVALUATION" | "QUESTIONNAIRE";
    title: string;
    type: string;
    due_at: string;
    course_title: string;
    status: string;
  }>;
  activity: StudentActivity[];
  history: History[];
};
const typeLabel: Record<string, string> = {
  EXAM: "Examen",
  PROJECT: "Proyecto",
  PRACTICE: "Práctica",
  QUIZ: "Quiz",
  TASK: "Tarea",
  QUESTIONNAIRE: "Cuestionario",
};
export function StudentDashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState<Enrollment[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>({
    evaluations: [],
    activities: [],
    activity: [],
    history: [],
  });
  useEffect(() => {
    Promise.all([
      api<Enrollment[]>("/enrollments/me"),
      api<DashboardData>("/student/dashboard"),
      api<DashboardData["activities"]>("/coursework/student"),
    ]).then(([enrollments, data, coursework]) => {
      setItems(enrollments.data);
      setDashboard({ ...data.data, activities: coursework.data });
    });
  }, []);
  const avg = items.length
    ? Math.round(items.reduce((s, x) => s + x.progress, 0) / items.length)
    : 0;
  const done = items.reduce((s, x) => s + x.completed_count, 0);
  const total = items.reduce((s, x) => s + x.lesson_count, 0);
  const maxHistory = Math.max(...dashboard.history.map((x) => x.completed), 1);
  const chart = dashboard.history.map((x) =>
    Math.max(5, Math.round((x.completed * 100) / maxHistory)),
  );
  return (
    <DashboardLayout>
      <div className="student-head">
        <div>
          <span>MI APRENDIZAJE</span>
          <h1>Hola, {user?.name.split(" ")[0]} 👋</h1>
          <p>Este es el resumen de tu progreso y próximas actividades.</p>
        </div>
        <Link to="/student/courses">
          <Compass />
          Explorar cursos
        </Link>
      </div>
      <div className="student-stats">
        {[
          [BookOpen, items.length, "Cursos activos"],
          [TrendingUp, `${avg}%`, "Progreso general"],
          [CheckCircle2, done, "Lecciones terminadas"],
          [
            Target,
            items.filter((x) => x.progress === 100).length,
            "Cursos completados",
          ],
        ].map(([Icon, value, label], i) => {
          const C = Icon as typeof BookOpen;
          return (
            <article key={String(label)}>
              <i className={`tone-${i}`}>
                <C />
              </i>
              <div>
                <strong>{String(value)}</strong>
                <span>{String(label)}</span>
                <small>
                  {i === 1
                    ? `${done} de ${total} lecciones`
                    : "Datos actualizados"}
                </small>
              </div>
            </article>
          );
        })}
      </div>
      <div className="student-grid">
        <section className="student-card student-chart">
          <header>
            <div>
              <h2>Tu progreso</h2>
              <p>Lecciones completadas por mes</p>
            </div>
            <select>
              <option>Últimos 6 meses</option>
            </select>
          </header>
          <div className="student-chart-area">
            <div className="student-y">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
            <div className="student-plot">
              <div className="student-lines">
                <i />
                <i />
                <i />
                <i />
              </div>
              {chart.length > 0 && (
                <svg viewBox="0 0 500 190" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="sarea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#623ef0" stopOpacity=".24" />
                      <stop offset="1" stopColor="#623ef0" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M${chart.map((v, i) => `${i * 100},${190 - v * 1.65}`).join(" L")} L500,190 L0,190 Z`}
                    fill="url(#sarea)"
                  />
                  <polyline
                    points={chart
                      .map((v, i) => `${i * 100},${190 - v * 1.65}`)
                      .join(" ")}
                    fill="none"
                    stroke="#623ef0"
                    strokeWidth="4"
                  />
                  {chart.map((v, i) => (
                    <circle
                      key={i}
                      cx={i * 100}
                      cy={190 - v * 1.65}
                      r="6"
                      fill="#fff"
                      stroke="#623ef0"
                      strokeWidth="4"
                    />
                  ))}
                </svg>
              )}
              <div className="student-x">
                {dashboard.history.map((x) => (
                  <span key={x.label}>{x.label}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="student-card upcoming">
          <header>
            <div>
              <h2>Próximas actividades</h2>
              <p>Tareas, evaluaciones y cuestionarios</p>
            </div>
            <CalendarDays />
          </header>
          {dashboard.activities.filter((item) => new Date(item.due_at) >= new Date() && !["GRADED", "VERIFIED"].includes(item.status)).length ? (
            dashboard.activities.filter((item) => new Date(item.due_at) >= new Date() && !["GRADED", "VERIFIED"].includes(item.status)).slice(0, 4).map((x, i) => {
              const date = new Date(x.due_at);
              return (
                <article key={x.id}>
                  <time className={`date-${i % 3}`}>
                    <small>
                      {date
                        .toLocaleDateString("es", { month: "short" })
                        .toUpperCase()}
                    </small>
                    <strong>{date.getDate()}</strong>
                  </time>
                  <div>
                    <strong>{x.title}</strong>
                    <span>{x.course_title}</span>
                  </div>
                  <Link className="student-activity-type" to="/student/tasks">
                    {typeLabel[x.type] ?? x.kind}
                  </Link>
                </article>
              );
            })
          ) : (
            <div className="student-no-courses">
              <CalendarDays />
              <p>No tienes actividades próximas.</p>
            </div>
          )}
        </section>
        <section className="student-card continue-learning">
          <header>
            <h2>Cursos activos</h2>
            <Link to="/student/courses">Ver todos</Link>
          </header>
          {items.length ? (
            items.slice(0, 4).map((x) => (
              <article key={x.id}>
                <img src={x.image_url} />
                <div>
                  <strong>{x.title}</strong>
                  <span>{x.instructor}</span>
                  <div className="student-progress">
                    <i style={{ width: `${x.progress}%` }} />
                  </div>
                  <small>{x.progress}% completado</small>
                </div>
                <Link to={`/classroom/${x.course_id}`}>
                  <Play />
                </Link>
              </article>
            ))
          ) : (
            <div className="student-no-courses">
              <BookOpen />
              <p>Aún no tienes cursos.</p>
              <Link to="/student/courses">Explorar catálogo</Link>
            </div>
          )}
        </section>
        <section className="student-card recent-student">
          <header>
            <h2>Actividad reciente</h2>
            <Activity />
          </header>
          {dashboard.activity.length ? (
            dashboard.activity.slice(0, 5).map((x, i) => (
              <article key={x.id}>
                <i className={`recent-icon r-${i % 4}`}>
                  <CheckCircle2 />
                </i>
                <p>
                  <strong>{x.lesson_title}</strong>
                  <span>{x.course_title}</span>
                </p>
                <time>{new Date(x.completed_at).toLocaleDateString("es")}</time>
              </article>
            ))
          ) : (
            <div className="student-no-courses">
              <Activity />
              <p>Tu actividad aparecerá aquí.</p>
            </div>
          )}
        </section>
        <section className="student-card quick-student">
          <header>
            <h2>Acciones rápidas</h2>
          </header>
          <div>
            <Link to="/student/courses">
              <Compass />
              <span>
                <strong>Explorar cursos</strong>
                <small>Encuentra algo nuevo</small>
              </span>
              <ArrowRight />
            </Link>
            {items[0] && (
              <Link to={`/classroom/${items[0].course_id}`}>
                <Play />
                <span>
                  <strong>Continuar curso</strong>
                  <small>Retoma tu lección</small>
                </span>
                <ArrowRight />
              </Link>
            )}
            <Link to="/profile">
              <UserRound />
              <span>
                <strong>Editar perfil</strong>
                <small>Actualiza tus datos</small>
              </span>
              <ArrowRight />
            </Link>
            <Link to="/student/tasks">
              <ListChecks />
              <span>
                <strong>Mis entregas</strong>
                <small>Tareas y evaluaciones</small>
              </span>
              <ArrowRight />
            </Link>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
