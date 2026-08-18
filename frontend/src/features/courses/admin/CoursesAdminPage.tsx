import {
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  Layers3,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "../../../components/Layout";
import { normalizeSearchText } from "../../../shared/utils/text";
import {
  CreateCourseDialog,
  CourseViewDialog,
} from "./components/CourseAdminDialogs";
import { useCoursesAdmin } from "./hooks/useCoursesAdmin";

export function CoursesAdmin() {
  const manager = useCoursesAdmin();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const visible = useMemo(() => {
    const term = normalizeSearchText(query);
    return term
      ? manager.courses.filter((course) =>
          normalizeSearchText(
            `${course.title} ${course.instructor} ${course.category_name} ${course.slug}`,
          ).includes(term),
        )
      : manager.courses;
  }, [manager.courses, query]);
  const published = manager.courses.filter(
    (course) => course.is_published,
  ).length;
  const modules = manager.courses.reduce(
    (sum, course) => sum + (course.module_count ?? course.modules?.length ?? 0),
    0,
  );
  return (
    <DashboardLayout>
      <div className="courses-admin-head">
        <div>
          <span>OFERTA ACADÉMICA</span>
          <h1>Gestión de cursos</h1>
          <p>Visualiza, modifica y controla la disponibilidad de cada curso.</p>
        </div>
        <button onClick={() => setCreating(true)}>
          <Plus />
          Nuevo curso
        </button>
      </div>
      {manager.message && (
        <div className="courses-admin-message">{manager.message}</div>
      )}
      <div className="courses-admin-stats">
        <article>
          <BookOpen />
          <span>
            <strong>{manager.courses.length}</strong>Total cursos
          </span>
        </article>
        <article>
          <CheckCircle2 />
          <span>
            <strong>{published}</strong>Publicados
          </span>
        </article>
        <article>
          <EyeOff />
          <span>
            <strong>{manager.courses.length - published}</strong>Inactivos
          </span>
        </article>
        <article>
          <Layers3 />
          <span>
            <strong>{modules}</strong>Módulos
          </span>
        </article>
      </div>
      <section className="courses-admin-card">
        <header>
          <div>
            <h2>Todos los cursos</h2>
            <span>{visible.length} resultados</span>
          </div>
          <label>
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar curso, instructor o categoría…"
            />
          </label>
        </header>
        {manager.loading ? (
          <div className="courses-admin-empty">Cargando cursos…</div>
        ) : visible.length ? (
          <div className="courses-admin-table">
            <table>
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Nivel</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <img src={course.image_url ?? ""} alt="" />
                      <span>
                        <strong>{course.title}</strong>
                        <small>
                          {course.instructor} ·{" "}
                          {course.category_name ?? "Sin categoría"}
                        </small>
                      </span>
                    </td>
                    <td>
                      <span className="course-level">{course.level}</span>
                    </td>
                    <td>
                      <strong>
                        {Number(course.price) === 0
                          ? "Gratis"
                          : `Bs ${Number(course.price).toFixed(2)}`}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={
                          course.is_published
                            ? "course-admin-state active"
                            : "course-admin-state"
                        }
                      >
                        {course.is_published ? "Publicado" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <div className="course-admin-actions">
                        <button
                          title="Ver curso"
                          onClick={() => void manager.view(course)}
                        >
                          <Eye />
                        </button>
                        <button
                          title="Editar contenido"
                          onClick={() =>
                            navigate(`/admin/course-editor?course=${course.id}`)
                          }
                        >
                          <Pencil />
                        </button>
                        <button
                          className={
                            course.is_published ? "deactivate" : "activate"
                          }
                          title={
                            course.is_published
                              ? "Desactivar curso"
                              : "Activar curso"
                          }
                          onClick={() => void manager.toggle(course)}
                        >
                          {course.is_published ? <EyeOff /> : <CheckCircle2 />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="courses-admin-empty">
            <Search />
            <h3>No se encontraron cursos</h3>
          </div>
        )}
      </section>
      {manager.detailLoading && (
        <div className="course-admin-backdrop">
          <div className="course-admin-loading">Cargando curso…</div>
        </div>
      )}
      {manager.selected && (
        <CourseViewDialog
          course={manager.selected}
          onClose={manager.closeDetail}
        />
      )}{" "}
      {creating && (
        <CreateCourseDialog
          categories={manager.categories}
          onClose={() => setCreating(false)}
          onCreate={manager.create}
        />
      )}
    </DashboardLayout>
  );
}
