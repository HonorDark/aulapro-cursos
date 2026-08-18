import {
  CheckCircle2,
  Eye,
  GraduationCap,
  Pencil,
  Search,
  Trash2,
  UserRoundCheck,
  UserRoundX,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { DashboardLayout } from "../../components/Layout";
import { normalizeSearchText } from "../../shared/utils/text";
import { StudentDialog } from "./components/StudentDialog";
import { useStudents } from "./hooks/useStudents";

export function StudentsAdmin() {
  const manager = useStudents();
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const term = normalizeSearchText(query);
    return term
      ? manager.students.filter((student) =>
          normalizeSearchText(`${student.name} ${student.email}`).includes(
            term,
          ),
        )
      : manager.students;
  }, [manager.students, query]);
  const active = manager.students.filter((student) => student.is_active).length;
  const enrollments = manager.students.reduce(
    (sum, student) => sum + student.enrollments,
    0,
  );

  return (
    <DashboardLayout>
      <div className="students-admin-head">
        <div>
          <span>GESTIÓN ACADÉMICA</span>
          <h1>Estudiantes</h1>
          <p>Consulta expedientes, edita cuentas y administra su acceso.</p>
        </div>
        <i>
          <Users />
        </i>
      </div>
      {manager.message && (
        <div className="students-admin-message">{manager.message}</div>
      )}
      <div className="students-admin-stats">
        <article>
          <i className="purple">
            <Users />
          </i>
          <span>
            <strong>{manager.students.length}</strong>Total estudiantes
          </span>
        </article>
        <article>
          <i className="green">
            <UserRoundCheck />
          </i>
          <span>
            <strong>{active}</strong>Cuentas activas
          </span>
        </article>
        <article>
          <i className="orange">
            <UserRoundX />
          </i>
          <span>
            <strong>{manager.students.length - active}</strong>Cuentas inactivas
          </span>
        </article>
        <article>
          <i className="blue">
            <GraduationCap />
          </i>
          <span>
            <strong>{enrollments}</strong>Inscripciones
          </span>
        </article>
      </div>
      <section className="students-admin-card">
        <header>
          <div>
            <h2>Directorio de estudiantes</h2>
            <span>{visible.length} resultados</span>
          </div>
          <label>
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o correo…"
            />
          </label>
        </header>
        {manager.loading ? (
          <div className="students-admin-empty">Cargando estudiantes…</div>
        ) : visible.length ? (
          <div className="students-admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Registro</th>
                  <th>Inscripciones</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <i className="student-row-avatar">
                        {student.name.charAt(0).toUpperCase()}
                      </i>
                      <span>
                        <strong>{student.name}</strong>
                        <small>{student.email}</small>
                      </span>
                    </td>
                    <td>
                      {new Date(student.created_at).toLocaleDateString("es")}
                    </td>
                    <td>
                      <b className="student-enrollment-count">
                        {student.enrollments}
                      </b>
                    </td>
                    <td>
                      <span
                        className={
                          student.is_active
                            ? "student-state active"
                            : "student-state"
                        }
                      >
                        <CheckCircle2 />
                        {student.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <div className="student-row-actions">
                        <button
                          type="button"
                          onClick={() => void manager.open(student, "view")}
                          title="Ver expediente"
                        >
                          <Eye />
                        </button>
                        <button
                          type="button"
                          onClick={() => void manager.open(student, "edit")}
                          title="Editar estudiante"
                        >
                          <Pencil />
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => void manager.open(student, "delete")}
                          title="Desactivar estudiante"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="students-admin-empty">
            <Search />
            <h3>No encontramos estudiantes</h3>
            <p>Prueba con otro nombre o correo electrónico.</p>
          </div>
        )}
      </section>
      {manager.mode && manager.dialogLoading && (
        <div className="student-modal-backdrop">
          <div className="student-dialog-loading">Cargando expediente…</div>
        </div>
      )}
      {manager.mode && manager.selected && (
        <StudentDialog
          student={manager.selected}
          mode={manager.mode}
          onClose={manager.close}
          onUpdate={manager.update}
          onRemove={manager.remove}
        />
      )}
    </DashboardLayout>
  );
}
