import {
  ArrowRight,
  BookOpen,
  Clock3,
  Filter,
  Search,
  Star,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../components/Layout";
import { api } from "../services/api";
import type { Course } from "../types";
const levels: Record<string, string> = {
  BEGINNER: "Inicial",
  INTERMEDIATE: "Intermedio",
  ADVANCED: "Avanzado",
};
export function StudentCourseExplorer() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(
      () =>
        api<Course[]>(
          `/courses?search=${encodeURIComponent(search)}&level=${level}`,
        )
          .then((r) => setCourses(r.data))
          .finally(() => setLoading(false)),
      200,
    );
    return () => clearTimeout(timer);
  }, [search, level]);
  return (
    <DashboardLayout>
      <div className="inside-catalog-head">
        <div>
          <span>CATÁLOGO</span>
          <h1>Explorar cursos</h1>
          <p>Encuentra tu próxima habilidad sin salir de tu panel.</p>
        </div>
        <div className="inside-catalog-count">
          <strong>{courses.length}</strong>
          <span>cursos disponibles</span>
        </div>
      </div>
      <div className="inside-searchbar">
        <label>
          <Search />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, profesor o habilidad…"
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X />
            </button>
          )}
        </label>
        <div>
          <Filter />
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">Todos los niveles</option>
            <option value="BEGINNER">Inicial</option>
            <option value="INTERMEDIATE">Intermedio</option>
            <option value="ADVANCED">Avanzado</option>
          </select>
        </div>
      </div>
      {loading ? (
        <div className="inside-course-grid loading">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <article key={i} />
          ))}
        </div>
      ) : courses.length ? (
        <div className="inside-course-grid">
          {courses.map((course) => (
            <article className="inside-course-card" key={course.id}>
              <Link
                className="inside-course-image"
                to={`/courses/${course.slug}`}
              >
                <img src={course.image_url ?? ""} alt="" />
                <span>{course.category_name ?? "Curso"}</span>
                <i>
                  <BookOpen />
                  Ver curso
                </i>
              </Link>
              <div className="inside-course-body">
                <div className="inside-rating">
                  <Star />
                  {(course.review_count ?? 0) > 0
                    ? Number(course.rating).toFixed(1)
                    : "Nuevo"}{" "}
                  <span>· {course.enrollment_count ?? 0} estudiantes</span>
                </div>
                <Link to={`/courses/${course.slug}`}>
                  <h2>{course.title}</h2>
                </Link>
                <p>{course.description}</p>
                <div className="inside-teacher">
                  <i>
                    {course.instructor
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </i>
                  <span>{course.instructor}</span>
                </div>
                <div className="inside-meta">
                  <span>
                    <Clock3 />
                    {Math.max(1, Math.round(course.duration_minutes / 60))} h
                  </span>
                  <span>
                    <Users />
                    {levels[course.level]}
                  </span>
                </div>
                <footer>
                  <strong>
                    {Number(course.price) === 0 ? "Gratis" : `$${course.price}`}
                  </strong>
                  <Link to={`/courses/${course.slug}`}>
                    Ver detalles <ArrowRight />
                  </Link>
                </footer>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="inside-empty">
          <Search />
          <h2>No encontramos cursos</h2>
          <p>Prueba con otra búsqueda o elimina los filtros.</p>
          <button
            onClick={() => {
              setSearch("");
              setLevel("");
            }}
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </DashboardLayout>
  );
}
