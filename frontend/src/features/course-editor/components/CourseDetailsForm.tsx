import { Image, Save } from "lucide-react";
import type { FormEvent } from "react";
import type { Course } from "../../../types";
import type { CourseCategory, CourseFormValues } from "../types";

type Props = {
  course: Course;
  categories: CourseCategory[];
  onSubmit: (values: CourseFormValues) => Promise<void>;
};

export function CourseDetailsForm({ course, categories, onSubmit }: Props) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void onSubmit({
      title: String(data.get("title") ?? ""),
      slug: String(data.get("slug") ?? ""),
      description: String(data.get("description") ?? ""),
      instructor: String(data.get("instructor") ?? ""),
      categoryId: String(data.get("categoryId") ?? "") || null,
      imageUrl: String(data.get("imageUrl") ?? "") || null,
      level: String(data.get("level") ?? "BEGINNER"),
      price: Number(data.get("price")),
      durationMinutes: Number(data.get("duration")),
      isPublished: data.get("published") === "on",
    });
  };

  return (
    <form key={course.id} className="course-main-editor" onSubmit={submit}>
      <section className="editor-cover">
        <img src={course.image_url ?? ""} alt={`Portada de ${course.title}`} />
        <label>
          <Image />
          URL de la portada
          <input
            name="imageUrl"
            type="url"
            defaultValue={course.image_url ?? ""}
            placeholder="https://..."
          />
        </label>
      </section>
      <section className="editor-fields">
        <div className="editor-title-row">
          <div>
            <span>FICHA DEL CURSO</span>
            <h2>Información general</h2>
          </div>
          <button type="submit">
            <Save /> Guardar cambios
          </button>
        </div>
        <div className="editor-two">
          <label>
            Título
            <input name="title" defaultValue={course.title} required />
          </label>
          <label>
            Slug
            <input name="slug" defaultValue={course.slug} required />
          </label>
        </div>
        <label>
          Descripción
          <textarea
            name="description"
            defaultValue={course.description}
            required
          />
        </label>
        <div className="editor-three">
          <label>
            Instructor
            <input
              name="instructor"
              defaultValue={course.instructor}
              required
            />
          </label>
          <label>
            Categoría
            <select name="categoryId" defaultValue={course.category_id ?? ""}>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nivel
            <select name="level" defaultValue={course.level}>
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
              defaultValue={course.price}
            />
          </label>
          <label>
            Duración total (min)
            <input
              name="duration"
              type="number"
              min="0"
              defaultValue={course.duration_minutes}
            />
          </label>
          <label className="publish-check">
            <input
              name="published"
              type="checkbox"
              defaultChecked={course.is_published}
            />
            <span>Curso publicado</span>
          </label>
        </div>
      </section>
    </form>
  );
}
