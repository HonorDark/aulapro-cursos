import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Mail,
  Pencil,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import type { StudentDetail, StudentDialogMode, StudentUpdate } from "../types";

type Props = {
  student: StudentDetail;
  mode: StudentDialogMode;
  onClose: () => void;
  onUpdate: (values: StudentUpdate) => Promise<void>;
  onRemove: () => Promise<void>;
};

function StudentOverview({ student }: { student: StudentDetail }) {
  return (
    <>
      <div className="student-detail-summary">
        <article>
          <BookOpen />
          <span>
            <strong>{student.enrollments}</strong>Cursos inscritos
          </span>
        </article>
        <article>
          <CheckCircle2 />
          <span>
            <strong>
              {
                student.courses.filter((course) => course.progress === 100)
                  .length
              }
            </strong>
            Cursos completados
          </span>
        </article>
        <article>
          <CalendarDays />
          <span>
            <strong>
              {new Date(student.created_at).toLocaleDateString("es")}
            </strong>
            Fecha de registro
          </span>
        </article>
      </div>
      <section className="student-course-list">
        <header>
          <h3>Cursos y progreso</h3>
          <span>{student.courses.length}</span>
        </header>
        {student.courses.length ? (
          student.courses.map((course) => (
            <article key={course.id}>
              <img src={course.image_url ?? ""} alt="" />
              <div>
                <strong>{course.title}</strong>
                <span>
                  {course.completed_count} de {course.lesson_count} lecciones
                </span>
                <div>
                  <i style={{ width: `${course.progress}%` }} />
                </div>
              </div>
              <b>{course.progress}%</b>
            </article>
          ))
        ) : (
          <div className="student-dialog-empty">
            <BookOpen /> Este estudiante todavía no tiene cursos.
          </div>
        )}
      </section>
    </>
  );
}

function StudentEditForm({
  student,
  onUpdate,
}: {
  student: StudentDetail;
  onUpdate: (values: StudentUpdate) => Promise<void>;
}) {
  const [active, setActive] = useState(student.is_active);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void onUpdate({
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      isActive: active,
    });
  };
  return (
    <form className="student-edit-form" onSubmit={submit}>
      <label>
        Nombre completo
        <div>
          <UserRound />
          <input
            name="name"
            defaultValue={student.name}
            required
            minLength={2}
          />
        </div>
      </label>
      <label>
        Correo electrónico
        <div>
          <Mail />
          <input
            name="email"
            type="email"
            defaultValue={student.email}
            required
          />
        </div>
      </label>
      <label className="student-status-switch">
        <span>
          <strong>Acceso a la plataforma</strong>
          <small>
            {active
              ? "El estudiante puede iniciar sesión"
              : "La cuenta no podrá iniciar sesión"}
          </small>
        </span>
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        <i />
      </label>
      <button className="student-dialog-primary">
        <Pencil /> Guardar cambios
      </button>
    </form>
  );
}

export function StudentDialog({
  student,
  mode,
  onClose,
  onUpdate,
  onRemove,
}: Props) {
  return (
    <div
      className="student-modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className={`student-dialog ${mode}`}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div className="student-dialog-avatar">
            {student.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <span>
              {mode === "view"
                ? "EXPEDIENTE DEL ESTUDIANTE"
                : mode === "edit"
                  ? "EDITAR ESTUDIANTE"
                  : "DESACTIVAR CUENTA"}
            </span>
            <h2>{student.name}</h2>
            <p>{student.email}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </header>

        {mode === "view" && <StudentOverview student={student} />}
        {mode === "edit" && (
          <StudentEditForm student={student} onUpdate={onUpdate} />
        )}
        {mode === "delete" && (
          <div className="student-delete-confirm">
            <i>
              <AlertTriangle />
            </i>
            <h3>¿Desactivar la cuenta del estudiante?</h3>
            <p>
              El estudiante no podrá iniciar sesión, pero se conservarán sus
              inscripciones, progreso, evaluaciones y pagos. Puedes reactivar la
              cuenta posteriormente desde Editar.
            </p>
            <footer>
              <button type="button" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="deactivate"
                onClick={() => void onRemove()}
              >
                <Trash2 /> Sí, desactivar cuenta
              </button>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
