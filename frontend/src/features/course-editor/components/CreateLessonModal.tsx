import { Check, Video, X } from "lucide-react";
import type { FormEvent } from "react";
import type { Module } from "../../../types";
import type { LessonFormValues } from "../types";

type Props = {
  module: Module;
  onClose: () => void;
  onSubmit: (values: LessonFormValues) => Promise<void>;
};

export function CreateLessonModal({ module, onClose, onSubmit }: Props) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void onSubmit({
      title: String(data.get("title") ?? ""),
      content: String(data.get("content") ?? ""),
      videoUrl: String(data.get("videoUrl") ?? "") || null,
      durationMinutes: Number(data.get("duration")),
      position: module.lessons.length + 1,
      isPreview: data.get("preview") === "on",
    });
  };

  return (
    <div className="editor-modal" role="dialog" aria-modal="true">
      <form onSubmit={submit}>
        <header>
          <div>
            <span>NUEVA LECCIÓN</span>
            <h2>{module.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar modal">
            <X />
          </button>
        </header>
        <label>
          Título
          <input name="title" required />
        </label>
        <label>
          Contenido
          <textarea name="content" required />
        </label>
        <label>
          <Video /> URL del video
          <input
            name="videoUrl"
            type="url"
            placeholder="https://www.youtube.com/embed/..."
          />
        </label>
        <label>
          Duración en minutos
          <input name="duration" type="number" min="0" defaultValue="15" />
        </label>
        <label className="publish-check">
          <input name="preview" type="checkbox" />
          <span>Vista previa pública</span>
        </label>
        <button className="editor-save">
          <Check /> Crear lección
        </button>
      </form>
    </div>
  );
}
