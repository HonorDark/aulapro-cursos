import { useCallback, useEffect, useState } from "react";
import { api } from "../../../../shared/api/client";
import type { Course } from "../../../../types";

export function useCoursesAdmin() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selected, setSelected] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const [courseResponse, categoryResponse] = await Promise.all([
      api<Course[]>("/courses/manage"),
      api<Array<{ id: string; name: string }>>("/courses/categories"),
    ]);
    setCourses(courseResponse.data);
    setCategories(categoryResponse.data);
  }, []);
  useEffect(() => {
    void load()
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [load]);
  const view = async (course: Course) => {
    setDetailLoading(true);
    try {
      const response = await api<Course>(`/courses/manage/${course.id}`);
      setSelected(response.data);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };
  const toggle = async (course: Course) => {
    try {
      await api(`/courses/${course.id}/publish`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: !course.is_published }),
      });
      setMessage(
        course.is_published
          ? `“${course.title}” fue desactivado.`
          : `“${course.title}” fue publicado.`,
      );
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };
  const create = async (values: Record<string, unknown>) => {
    try {
      await api("/courses", { method: "POST", body: JSON.stringify(values) });
      setMessage("Curso creado como borrador.");
      await load();
      return null;
    } catch (error) {
      const detail = (error as Error).message;
      setMessage(detail);
      return detail;
    }
  };
  return {
    courses,
    categories,
    selected,
    loading,
    detailLoading,
    message,
    load,
    view,
    toggle,
    create,
    closeDetail: () => setSelected(null),
  };
}
