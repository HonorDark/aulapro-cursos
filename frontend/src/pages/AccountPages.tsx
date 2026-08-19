import {
  Ban,
  CheckCircle2,
  Plus,
  Shield,
  UserCog,
  Users,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout, PublicHeader } from "../components/Layout";
import { dashboardFor } from "../components/Routes";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../features/notifications/feedback-context";
import { api } from "../services/api";
import type { Role, User } from "../types";

type AdminUser = User & { is_active?: boolean; isActive: boolean };

export function UsersAdmin() {
  const feedback = useFeedback();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await api<AdminUser[]>("/users");
      setUsers(
        response.data.map((user) => ({
          ...user,
          isActive: user.isActive ?? user.is_active ?? true,
        })),
      );
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () => ({
      users: users.length,
      admins: users.filter((user) => user.role === "ADMIN").length,
      inactive: users.filter((user) => !user.isActive).length,
    }),
    [users],
  );

  const changeRole = async (user: AdminUser, role: Role) => {
    try {
      await api(`/users/${user.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      feedback.success(
        "Rol actualizado",
        `${user.name} ahora tiene el rol ${role}.`,
      );
      await load();
    } catch (changeError) {
      feedback.error(
        "No se pudo cambiar el rol",
        (changeError as Error).message,
      );
    }
  };

  const changeStatus = async (user: AdminUser) => {
    if (user.isActive) {
      const accepted = await feedback.confirm({
        title: "Desactivar usuario",
        message: `${user.name} perderá el acceso, pero sus datos y actividad se conservarán.`,
        confirmLabel: "Desactivar cuenta",
        tone: "danger",
      });
      if (!accepted) return;
    }
    try {
      await api(`/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      feedback.success(
        user.isActive ? "Cuenta desactivada" : "Cuenta activada",
      );
      await load();
    } catch (changeError) {
      feedback.error(
        "No se pudo actualizar la cuenta",
        (changeError as Error).message,
      );
    }
  };

  const createAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await api("/users/admins", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name")),
          email: String(form.get("email")),
          password: String(form.get("password")),
        }),
      });
      setCreating(false);
      feedback.success(
        "Administrador creado",
        "La nueva cuenta ya puede iniciar sesión.",
      );
      await load();
    } catch (createError) {
      feedback.error(
        "No se pudo crear el administrador",
        (createError as Error).message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="users-admin-view">
        <div className="users-admin-head">
          <div>
            <span className="eyebrow">Seguridad y acceso</span>
            <h1>Usuarios y roles</h1>
            <p>
              Gestiona estudiantes y administradores. Los SUPER_ADMIN están
              protegidos.
            </p>
          </div>
          <button type="button" onClick={() => setCreating(true)}>
            <Plus /> Nuevo administrador
          </button>
        </div>

        <div className="users-admin-kpis">
          <article>
            <Users />
            <span><strong>{totals.users}</strong>Usuarios</span>
          </article>
          <article>
            <UserCog />
            <span><strong>{totals.admins}</strong>Administradores</span>
          </article>
          <article>
            <Ban />
            <span><strong>{totals.inactive}</strong>Inactivos</span>
          </article>
        </div>

        {error && <div className="alert">{error}</div>}
        <section className="panel table-wrap users-admin-table">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Permisos</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="users-table-state">
                    Cargando usuarios…
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </td>
                  <td>
                    <span
                      className={`badge ${user.role === "SUPER_ADMIN" ? "super" : ""}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td>
                    {user.isActive ? (
                      <span className="status active">
                        <CheckCircle2 /> Activo
                      </span>
                    ) : (
                      <span className="status">
                        <Ban /> Inactivo
                      </span>
                    )}
                  </td>
                  <td>
                    {user.role === "SUPER_ADMIN" ? (
                      <span className="locked">
                        <Shield /> Protegido
                      </span>
                    ) : (
                      <div className="row-actions">
                        <select
                          value={user.role}
                          onChange={(event) =>
                            void changeRole(user, event.target.value as Role)
                          }
                          aria-label={`Cambiar rol de ${user.name}`}
                        >
                          <option value="STUDENT">STUDENT</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                        <button
                          className="table-action"
                          onClick={() => void changeStatus(user)}
                        >
                          {user.isActive ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && !users.length && !error && (
                <tr>
                  <td colSpan={4} className="users-table-state">
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {creating && (
          <div className="users-admin-modal" role="presentation">
            <form onSubmit={createAdmin} aria-labelledby="create-admin-title">
              <header>
                <div>
                  <span>ACCESO ADMINISTRATIVO</span>
                  <h2 id="create-admin-title">Nuevo administrador</h2>
                  <p>Crea una cuenta con permisos de gestión académica.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  aria-label="Cerrar"
                >
                  <X />
                </button>
              </header>
              <label>
                Nombre completo
                <input name="name" minLength={2} maxLength={120} required />
              </label>
              <label>
                Correo electrónico
                <input name="email" type="email" required />
              </label>
              <label>
                Contraseña temporal
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  maxLength={72}
                  required
                />
              </label>
              <aside>
                Comparte la contraseña por un canal seguro. El administrador
                podrá cambiarla desde su perfil.
              </aside>
              <footer>
                <button type="button" onClick={() => setCreating(false)}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving}>
                  <Shield /> {saving ? "Creando…" : "Crear administrador"}
                </button>
              </footer>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export function Forbidden() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(5);
  const destination = user ? dashboardFor(user.role) : "/login";

  useEffect(() => {
    const interval = window.setInterval(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1_000,
    );
    const redirect = window.setTimeout(
      () => navigate(destination, { replace: true }),
      5_000,
    );
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(redirect);
    };
  }, [destination, navigate]);

  return (
    <>
      <PublicHeader />
      <main className="forbidden">
        <span>403</span>
        <Shield />
        <h1>Acceso no autorizado</h1>
        <p>Tu cuenta no tiene permisos para ver esta página.</p>
        <small>Volverás a tu panel en {seconds} segundos.</small>
        <Link className="button" to={destination}>
          Volver a mi panel
        </Link>
      </main>
    </>
  );
}
