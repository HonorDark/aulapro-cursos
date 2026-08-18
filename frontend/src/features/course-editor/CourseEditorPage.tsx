import { Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../../components/Layout";
import { CourseDetailsForm } from "./components/CourseDetailsForm";
import { CoursePicker } from "./components/CoursePicker";
import { CreateLessonModal } from "./components/CreateLessonModal";
import { CreateModuleModal } from "./components/CreateModuleModal";
import { ModuleEditor } from "./components/ModuleEditor";
import { useCourseEditor } from "./hooks/useCourseEditor";

export function CourseEditor() {
  const [searchParams] = useSearchParams();
  const editor = useCourseEditor(searchParams.get("course"));

  return (
    <DashboardLayout>
      <div className="editor-head">
        <div>
          <span>GESTIÓN DE CONTENIDOS</span>
          <h1>Editor completo de cursos</h1>
          <p>
            Actualiza la presentación, módulos, lecciones y material
            audiovisual.
          </p>
        </div>
        <CoursePicker
          courses={editor.courses}
          selectedId={editor.course?.id ?? ""}
          onSelect={(id) => void editor.loadCourse(id)}
        />
      </div>

      {editor.message && <div className="editor-message">{editor.message}</div>}
      {editor.loading && !editor.course && (
        <div className="page-state">Cargando editor de contenidos…</div>
      )}

      {editor.course && (
        <>
          <CourseDetailsForm
            course={editor.course}
            categories={editor.categories}
            onSubmit={editor.saveCourse}
          />
          <div className="curriculum-editor-head">
            <div>
              <span>ESTRUCTURA ACADÉMICA</span>
              <h2>Módulos y lecciones</h2>
            </div>
            <button type="button" onClick={editor.openModuleModal}>
              <Plus /> Nuevo módulo
            </button>
          </div>
          <div className="curriculum-editor">
            {editor.course.modules?.map((module) => (
              <ModuleEditor
                key={module.id}
                module={module}
                onSave={editor.saveModule}
                onRemove={editor.removeModule}
                onAddLesson={editor.openLessonModal}
                onSaveLesson={editor.saveLesson}
                onRemoveLesson={editor.removeLesson}
              />
            ))}
          </div>
        </>
      )}

      {editor.lessonModule && (
        <CreateLessonModal
          module={editor.lessonModule}
          onClose={editor.closeLessonModal}
          onSubmit={editor.addLesson}
        />
      )}
      {editor.moduleModalOpen && editor.course && (
        <CreateModuleModal
          nextPosition={(editor.course.modules?.length ?? 0) + 1}
          onClose={editor.closeModuleModal}
          onSubmit={editor.addModule}
        />
      )}
    </DashboardLayout>
  );
}
