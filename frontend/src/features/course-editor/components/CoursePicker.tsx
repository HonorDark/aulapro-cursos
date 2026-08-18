import { ChevronDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { normalizeSearchText } from "../../../shared/utils/text";
import type { Course } from "../../../types";

type Props = {
  courses: Course[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function CoursePicker({ courses, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const normalized = normalizeSearchText(query);
    if (!normalized) return courses;
    return courses.filter((course) =>
      [course.title, course.slug, course.instructor, course.category_name].some(
        (value) => normalizeSearchText(value).includes(normalized),
      ),
    );
  }, [courses, query]);
  const selectedCourse = courses.find((course) => course.id === selectedId);
  const visibleCourses =
    selectedCourse && !matches.some((course) => course.id === selectedId)
      ? [selectedCourse, ...matches]
      : matches;

  return (
    <section className="course-picker">
      <label htmlFor="course-search">Buscar curso</label>
      <div className="course-search-field">
        <Search />
        <input
          id="course-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Título, instructor, categoría o slug..."
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Limpiar búsqueda"
          >
            <X />
          </button>
        )}
      </div>
      <div className="course-select-field">
        <select
          value={selectedId}
          onChange={(event) => onSelect(event.target.value)}
          disabled={!visibleCourses.length}
        >
          {visibleCourses.length ? (
            visibleCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))
          ) : (
            <option value="">No se encontraron cursos</option>
          )}
        </select>
        <ChevronDown />
      </div>
      <small>
        {matches.length} de {courses.length} cursos
      </small>
    </section>
  );
}
