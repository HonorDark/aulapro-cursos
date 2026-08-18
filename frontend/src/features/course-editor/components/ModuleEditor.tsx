import { BookOpen, ChevronDown, Plus, Save, Trash2, Video } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Lesson } from "../../../types";
import type { LessonFormValues, ModuleEditorProps } from "../types";

function lessonValues(event: FormEvent<HTMLFormElement>): LessonFormValues {
  const data = new FormData(event.currentTarget);
  return {
    title: String(data.get("title") ?? ""),
    content: String(data.get("content") ?? ""),
    videoUrl: String(data.get("videoUrl") ?? "") || null,
    durationMinutes: Number(data.get("duration")),
    position: Number(data.get("position")),
    isPreview: data.get("preview") === "on",
  };
}

function LessonEditor({
  lesson,
  onSave,
  onRemove,
}: {
  lesson: Lesson;
  onSave: (values: LessonFormValues) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  return (
    <form
      className="lesson-editor-row"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(lessonValues(event));
      }}
    >
      <div className="lesson-number">{lesson.position}</div>
      <div className="lesson-editor-fields">
        <div>
          <label>
            Título
            <input name="title" defaultValue={lesson.title} />
          </label>
          <label>
            Posición
            <input
              name="position"
              type="number"
              min="1"
              defaultValue={lesson.position}
            />
          </label>
          <label>
            Duración (min)
            <input
              name="duration"
              type="number"
              min="0"
              defaultValue={lesson.duration_minutes}
            />
          </label>
        </div>
        <label>
          <Video /> URL del video
          <input
            name="videoUrl"
            type="url"
            defaultValue={lesson.video_url ?? ""}
          />
        </label>
        <label>
          Contenido
          <textarea name="content" defaultValue={lesson.content} />
        </label>
        <label className="publish-check">
          <input
            name="preview"
            type="checkbox"
            defaultChecked={lesson.is_preview}
          />
          <span>Disponible como vista previa</span>
        </label>
      </div>
      <div className="lesson-actions-edit">
        <button type="submit">
          <Save /> Guardar lección
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => void onRemove()}
        >
          <Trash2 /> Eliminar
        </button>
      </div>
    </form>
  );
}

export function ModuleEditor({
  module,
  onSave,
  onRemove,
  onAddLesson,
  onSaveLesson,
  onRemoveLesson,
}: ModuleEditorProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(module.title);
  const [position, setPosition] = useState(module.position);

  return (
    <article className={open ? "module-expanded" : ""}>
      <header className="module-editor-summary">
        <button type="button" onClick={() => setOpen((value) => !value)}>
          <BookOpen />
          <span>
            <strong>
              Módulo {module.position}: {module.title}
            </strong>
            <small>
              {module.lessons.length} lecciones · Clic para{" "}
              {open ? "cerrar" : "editar"}
            </small>
          </span>
          <ChevronDown />
        </button>
      </header>
      {open && (
        <div className="module-editor-body">
          <section className="module-settings-card">
            <div>
              <span>CONFIGURACIÓN DEL MÓDULO</span>
              <h3>Información general</h3>
            </div>
            <div className="module-settings">
              <label>
                Nombre del módulo
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label>
                Posición
                <input
                  type="number"
                  min="1"
                  value={position}
                  onChange={(event) => setPosition(Number(event.target.value))}
                />
              </label>
            </div>
            <footer>
              <button
                type="button"
                className="delete-module"
                onClick={() => void onRemove(module)}
              >
                <Trash2 /> Eliminar módulo
              </button>
              <button
                type="button"
                className="save-module"
                onClick={() => void onSave(module, title, position)}
              >
                <Save /> Guardar módulo
              </button>
            </footer>
          </section>
          <div className="lessons-editor-heading">
            <div>
              <strong>Lecciones del módulo</strong>
              <span>{module.lessons.length} contenidos</span>
            </div>
            <button type="button" onClick={() => onAddLesson(module)}>
              <Plus /> Agregar lección
            </button>
          </div>
          {module.lessons.map((lesson) => (
            <LessonEditor
              key={lesson.id}
              lesson={lesson}
              onSave={(values) => onSaveLesson(module, lesson, values)}
              onRemove={() => onRemoveLesson(lesson)}
            />
          ))}
        </div>
      )}
    </article>
  );
}
