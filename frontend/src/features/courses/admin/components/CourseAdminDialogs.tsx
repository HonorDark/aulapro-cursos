import { BookOpen, Clock3, Layers3, Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Course } from "../../../../types";

export function CourseViewDialog({
  course,
  onClose,
}: {
  course: Course;
  onClose: () => void;
}) {
  const lessons =
    course.modules?.reduce((sum, module) => sum + module.lessons.length, 0) ??
    0;
  return (
    <div className="course-admin-backdrop" onMouseDown={onClose}>
      <section
        className="course-admin-dialog view"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <img src={course.image_url ?? ""} alt="" />
          <div>
            <span>VISTA DEL CURSO</span>
            <h2>{course.title}</h2>
            <p>
              {course.instructor} · {course.category_name ?? "Sin categoría"}
            </p>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <p className="course-admin-description">{course.description}</p>
        <div className="course-admin-facts">
          <span>
            <Layers3 />
            <strong>{course.modules?.length ?? 0}</strong>Módulos
          </span>
          <span>
            <BookOpen />
            <strong>{lessons}</strong>Lecciones
          </span>
          <span>
            <Clock3 />
            <strong>{Math.round(course.duration_minutes / 60)}h</strong>Duración
          </span>
        </div>
        <div className="course-admin-modules">
          <h3>Contenido académico</h3>
          {course.modules?.length ? (
            course.modules.map((module) => (
              <article key={module.id}>
                <i>{module.position}</i>
                <span>
                  <strong>{module.title}</strong>
                  <small>{module.lessons.length} lecciones</small>
                </span>
              </article>
            ))
          ) : (
            <p>Este curso todavía no tiene módulos.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export function CreateCourseDialog({
  categories,
  onClose,
  onCreate,
}: {
  categories: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCreate: (values: Record<string, unknown>) => Promise<string | null>;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const makeSlug = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    const createError = await onCreate({
      title: data.get("title"),
      slug: data.get("slug"),
      description: data.get("description"),
      instructor: data.get("instructor"),
      categoryId: data.get("categoryId") || null,
      imageUrl: data.get("imageUrl") || null,
      level: data.get("level"),
      price: Number(data.get("price")),
      durationMinutes: Number(data.get("duration")),
      isPublished: false,
    });
    setSubmitting(false);
    if (createError) setError(createError);
    else onClose();
  };
  return (
    <div className="course-admin-backdrop" onMouseDown={onClose}>
      <form
        className="course-admin-dialog create"
        onSubmit={(event) => void submit(event)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>NUEVO CURSO</span>
            <h2>Crear curso como borrador</h2>
            <p>Después podrás completar portada, módulos y lecciones.</p>
          </div>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </header>
        {error && <div className="course-create-error">{error}</div>}
        <label>
          Título
          <input
            name="title"
            required
            minLength={3}
            maxLength={180}
            autoFocus
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (!slugEdited) setSlug(makeSlug(event.target.value));
            }}
            placeholder="Ej. Diseño UX desde cero"
          />
        </label>
        <label>
          URL amigable
          <input
            name="slug"
            required
            pattern="[a-z0-9-]+"
            value={slug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(makeSlug(event.target.value));
            }}
            placeholder="nombre-del-curso"
          />
        </label>
        <label>
          Descripción
          <textarea name="description" required minLength={10} />
        </label>
        <div>
          <label>
            Instructor
            <input name="instructor" required />
          </label>
          <label>
            Categoría
            <select name="categoryId" defaultValue="">
              <option value="">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nivel
            <select name="level">
              <option value="BEGINNER">Básico</option>
              <option value="INTERMEDIATE">Intermedio</option>
              <option value="ADVANCED">Avanzado</option>
            </select>
          </label>
          <label>
            Precio
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
            />
          </label>
          <label>
            Duración (min)
            <input name="duration" type="number" min="0" defaultValue="60" />
          </label>
        </div>
        <label>
          URL de la portada
          <input
            name="imageUrl"
            type="url"
            placeholder="https://ejemplo.com/portada.jpg"
          />
        </label>
        <button className="course-create-submit" disabled={submitting}>
          <Plus />
          {submitting ? "Creando curso..." : "Crear borrador"}
        </button>
      </form>
    </div>
  );
}
