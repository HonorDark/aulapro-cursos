import { useCallback, useEffect, useState } from "react";
import { api } from "../../../services/api";
import { useFeedback } from "../../notifications/feedback-context";
import type { Course, Lesson, Module } from "../../../types";
import type {
  CourseCategory,
  CourseFormValues,
  LessonFormValues,
  ModuleFormValues,
} from "../types";

export function useCourseEditor(initialCourseId?: string | null) {
  const feedback = useFeedback();
  const [courses, setCourses] = useState<Course[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [lessonModule, setLessonModule] = useState<Module | null>(null);
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadCourse = useCallback(async (id: string) => {
    if (!id) return;
    const response = await api<Course>(`/courses/manage/${id}`);
    setCourse(response.data);
  }, []);

  const loadCatalog = useCallback(async () => {
    const [courseResponse, categoryResponse] = await Promise.all([
      api<Course[]>("/courses/manage"),
      api<CourseCategory[]>("/courses/categories"),
    ]);
    setCourses(courseResponse.data);
    setCategories(categoryResponse.data);
    return courseResponse.data;
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadCatalog()
      .then(async (items) => {
        const requestedCourse = items.find(
          (item) => item.id === initialCourseId,
        );
        const selectedCourse = requestedCourse ?? items[0];
        if (active && selectedCourse) await loadCourse(selectedCourse.id);
      })
      .catch((error: Error) => active && setMessage(error.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [initialCourseId, loadCatalog, loadCourse]);

  const refresh = useCallback(
    async (courseId: string) => {
      await Promise.all([loadCourse(courseId), loadCatalog()]);
    },
    [loadCatalog, loadCourse],
  );

  const run = useCallback(
    async (action: () => Promise<void>) => {
      try {
        await action();
      } catch (error) {
        setMessage((error as Error).message);
        feedback.error("No se pudo completar la acción", (error as Error).message);
      }
    },
    [feedback],
  );

  const saveCourse = (values: CourseFormValues) =>
    run(async () => {
      if (!course) return;
      await api(`/courses/${course.id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });
      setMessage("Ficha del curso actualizada.");
      await refresh(course.id);
    });

  const addModule = async (values: ModuleFormValues) => {
    if (!course) return false;
    try {
      await api(`/courses/${course.id}/modules`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      setModuleModalOpen(false);
      setMessage("Módulo creado correctamente.");
      feedback.success("Módulo creado", "Ya puedes agregar lecciones y contenido.");
      await refresh(course.id);
      return true;
    } catch (error) {
      setMessage((error as Error).message);
      return false;
    }
  };

  const saveModule = (module: Module, title: string, position: number) =>
    run(async () => {
      if (!course) return;
      await api(`/courses/${course.id}/modules/${module.id}`, {
        method: "PUT",
        body: JSON.stringify({ title, position }),
      });
      setMessage("Módulo actualizado.");
      await refresh(course.id);
    });

  const removeModule = (module: Module) =>
    run(async () => {
      if (!course) return;
      const accepted = await feedback.confirm({
        title: "Eliminar módulo",
        message: `Se eliminará “${module.title}” junto con todas sus lecciones. Esta acción no se puede deshacer.`,
        confirmLabel: "Sí, eliminar módulo",
        tone: "danger",
      });
      if (!accepted) return;
      await api(`/courses/${course.id}/modules/${module.id}`, {
        method: "DELETE",
      });
      setMessage("Módulo eliminado.");
      feedback.success("Módulo eliminado");
      await refresh(course.id);
    });

  const saveLesson = (
    _module: Module,
    lesson: Lesson,
    values: LessonFormValues,
  ) =>
    run(async () => {
      if (!course) return;
      await api(`/courses/${course.id}/lessons/${lesson.id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });
      setMessage("Lección y video actualizados.");
      await refresh(course.id);
    });

  const removeLesson = (lesson: Lesson) =>
    run(async () => {
      if (!course) return;
      const accepted = await feedback.confirm({
        title: "Eliminar lección",
        message: `La lección “${lesson.title}” se eliminará definitivamente.`,
        confirmLabel: "Sí, eliminar lección",
        tone: "danger",
      });
      if (!accepted) return;
      await api(`/courses/${course.id}/lessons/${lesson.id}`, {
        method: "DELETE",
      });
      setMessage("Lección eliminada.");
      feedback.success("Lección eliminada");
      await refresh(course.id);
    });

  const addLesson = (values: LessonFormValues) =>
    run(async () => {
      if (!lessonModule || !course) return;
      await api("/lessons", {
        method: "POST",
        body: JSON.stringify({
          moduleId: lessonModule.id,
          ...values,
          position: lessonModule.lessons.length + 1,
        }),
      });
      setLessonModule(null);
      setMessage("Lección creada.");
      await refresh(course.id);
    });

  return {
    courses,
    course,
    categories,
    lessonModule,
    moduleModalOpen,
    message,
    loading,
    loadCourse,
    saveCourse,
    addModule,
    saveModule,
    removeModule,
    saveLesson,
    removeLesson,
    addLesson,
    openModuleModal: () => setModuleModalOpen(true),
    closeModuleModal: () => setModuleModalOpen(false),
    openLessonModal: setLessonModule,
    closeLessonModal: () => setLessonModule(null),
  };
}
