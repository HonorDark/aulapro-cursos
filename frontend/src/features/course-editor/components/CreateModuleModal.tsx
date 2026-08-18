import { Check, Layers3, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { ModuleFormValues } from "../types";

type Props = {
  nextPosition: number;
  onClose: () => void;
  onSubmit: (values: ModuleFormValues) => Promise<boolean>;
};

export function CreateModuleModal({ nextPosition, onClose, onSubmit }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    const created = await onSubmit({
      title: String(data.get("title") ?? "").trim(),
      position: Number(data.get("position")),
    });
    setSubmitting(false);
    if (!created) setError("No se pudo crear el módulo. Revisa los datos.");
  };

  return (
    <div
      className="editor-modal module-create-modal"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <form
        onSubmit={(event) => void submit(event)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>NUEVO MÓDULO</span>
            <h2>Agrega una etapa al curso</h2>
            <p>Organiza las lecciones dentro de una unidad clara y ordenada.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar modal">
            <X />
          </button>
        </header>
        <div className="module-modal-icon">
          <Layers3 />
          <span>
            <strong>Estructura académica</strong>
            Después podrás agregar videos, contenido y recursos.
          </span>
        </div>
        {error && <div className="editor-modal-error">{error}</div>}
        <label>
          Nombre del módulo
          <input
            name="title"
            required
            minLength={2}
            maxLength={180}
            autoFocus
            placeholder="Ej. Fundamentos y conceptos esenciales"
          />
        </label>
        <label>
          Posición dentro del curso
          <input
            name="position"
            type="number"
            min="1"
            step="1"
            required
            defaultValue={nextPosition}
          />
        </label>
        <button className="editor-save" disabled={submitting}>
          <Check /> {submitting ? "Creando módulo..." : "Crear módulo"}
        </button>
      </form>
    </div>
  );
}
