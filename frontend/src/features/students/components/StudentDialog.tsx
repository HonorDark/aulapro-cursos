import {
  AlertTriangle,
  BookOpen,
  Camera,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  IdCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
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
        <article>
          <CreditCard />
          <span>
            <strong>{student.payments}</strong>Pagos registrados
          </span>
        </article>
      </div>
      <section className="student-profile-details">
        <header>
          <h3>Datos personales y contacto</h3>
          <span>{student.profile_fields}/7 campos completos</span>
        </header>
        <div>
          <article>
            <Phone />
            <span>
              <small>Teléfono</small>
              <strong>{student.phone || "No registrado"}</strong>
            </span>
          </article>
          <article>
            <IdCard />
            <span>
              <small>CI / Documento</small>
              <strong>{student.document_number || "No registrado"}</strong>
            </span>
          </article>
          <article>
            <MapPin />
            <span>
              <small>Ubicación</small>
              <strong>
                {[student.city, student.country].filter(Boolean).join(", ") ||
                  "No registrada"}
              </strong>
            </span>
          </article>
          <article>
            <CalendarDays />
            <span>
              <small>Fecha de nacimiento</small>
              <strong>
                {student.birth_date
                  ? new Date(
                      `${student.birth_date.slice(0, 10)}T00:00:00`,
                    ).toLocaleDateString("es")
                  : "No registrada"}
              </strong>
            </span>
          </article>
        </div>
        {(student.address || student.bio) && (
          <footer>
            {student.address && (
              <p>
                <strong>Dirección:</strong> {student.address}
              </p>
            )}
            {student.bio && (
              <p>
                <strong>Acerca del estudiante:</strong> {student.bio}
              </p>
            )}
          </footer>
        )}
      </section>
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
  const [avatar, setAvatar] = useState(student.avatar_url);
  const chooseAvatar = (file?: File) => {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return;
    if (file.size > 1.5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void onUpdate({
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      isActive: active,
      avatarUrl: avatar,
      phone: String(data.get("phone") ?? "") || null,
      documentNumber: String(data.get("documentNumber") ?? "") || null,
      country: String(data.get("country") ?? "") || null,
      city: String(data.get("city") ?? "") || null,
      address: String(data.get("address") ?? "") || null,
      birthDate: String(data.get("birthDate") ?? "") || null,
      bio: String(data.get("bio") ?? "") || null,
    });
  };
  return (
    <form className="student-edit-form" onSubmit={submit}>
      <div className="student-avatar-editor">
        <i>
          {avatar ? (
            <img src={avatar} alt={`Foto de ${student.name}`} />
          ) : (
            student.name.charAt(0).toUpperCase()
          )}
        </i>
        <span>
          <strong>Foto de perfil</strong>
          <small>JPG, PNG o WEBP · máximo 1.5 MB</small>
        </span>
        <label>
          <Camera /> Cambiar foto
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => chooseAvatar(event.target.files?.[0])}
          />
        </label>
      </div>
      <div className="student-edit-grid">
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
      <label>
        Número de teléfono
        <div>
          <Phone />
          <input
            name="phone"
            type="tel"
            defaultValue={student.phone ?? ""}
            maxLength={30}
            placeholder="+591 70000000"
          />
        </div>
      </label>
      <label>
        CI / Documento
        <div>
          <IdCard />
          <input
            name="documentNumber"
            defaultValue={student.document_number ?? ""}
            maxLength={40}
          />
        </div>
      </label>
      <label>
        País
        <div>
          <MapPin />
          <input
            name="country"
            defaultValue={student.country ?? ""}
            maxLength={80}
          />
        </div>
      </label>
      <label>
        Ciudad
        <div>
          <MapPin />
          <input
            name="city"
            defaultValue={student.city ?? ""}
            maxLength={100}
          />
        </div>
      </label>
      <label>
        Fecha de nacimiento
        <div>
          <CalendarDays />
          <input
            name="birthDate"
            type="date"
            defaultValue={student.birth_date?.slice(0, 10) ?? ""}
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </label>
      <label className="student-edit-wide">
        Dirección
        <div>
          <MapPin />
          <input
            name="address"
            defaultValue={student.address ?? ""}
            maxLength={220}
          />
        </div>
      </label>
      <label className="student-edit-wide">
        Acerca del estudiante
        <textarea
          name="bio"
          defaultValue={student.bio ?? ""}
          maxLength={500}
          placeholder="Información académica o personal relevante"
        />
      </label>
      </div>
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
            {student.avatar_url ? (
              <img src={student.avatar_url} alt="" />
            ) : (
              student.name.charAt(0).toUpperCase()
            )}
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
