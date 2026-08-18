import { Ban, CheckCircle2, KeyRound, Shield, UserCog } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout, PublicHeader } from "../components/Layout";
import { dashboardFor } from "../components/Routes";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import type { Role, User } from "../types";
export function Profile() {
  const { user, refresh } = useAuth();
  const [message, setMessage] = useState("");
  const profile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: f.get("name"),
          avatarUrl: f.get("avatar") || null,
        }),
      });
      await refresh();
      setMessage("Perfil actualizado.");
    } catch (err) {
      setMessage((err as Error).message);
    }
  };
  const password = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("new") !== f.get("confirm"))
      return setMessage("Las contraseñas nuevas no coinciden.");
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: f.get("current"),
          newPassword: f.get("new"),
        }),
      });
      e.currentTarget.reset();
      setMessage("Contraseña actualizada.");
    } catch (err) {
      setMessage((err as Error).message);
    }
  };
  return (
    <DashboardLayout>
      <div className="page-title">
        <span className="eyebrow">Cuenta</span>
        <h1>Mi perfil</h1>
        <p>Actualiza tu información y protege tu acceso.</p>
      </div>
      {message && <div className="alert">{message}</div>}
      <div className="profile-grid">
        <form className="panel form-panel" onSubmit={profile}>
          <h2>
            <UserCog />
            Información personal
          </h2>
          <label>
            Nombre
            <input name="name" defaultValue={user?.name} required />
          </label>
          <label>
            Correo
            <input value={user?.email} disabled />
          </label>
          <label>
            URL del avatar
            <input
              name="avatar"
              type="url"
              defaultValue={user?.avatarUrl ?? ""}
            />
          </label>
          <button className="button">Guardar cambios</button>
        </form>
        <form className="panel form-panel" onSubmit={password}>
          <h2>
            <KeyRound />
            Cambiar contraseña
          </h2>
          <label>
            Contraseña actual
            <input name="current" type="password" required />
          </label>
          <label>
            Nueva contraseña
            <input name="new" type="password" minLength={8} required />
          </label>
          <label>
            Confirmar nueva contraseña
            <input name="confirm" type="password" minLength={8} required />
          </label>
          <button className="button">Actualizar contraseña</button>
        </form>
      </div>
    </DashboardLayout>
  );
}
type AdminUser = User & { is_active?: boolean; isActive: boolean };
export function UsersAdmin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [message, setMessage] = useState("");
  const load = () =>
    api<AdminUser[]>("/users").then((r) =>
      setUsers(
        r.data.map((u) => ({
          ...u,
          isActive: u.isActive ?? u.is_active ?? true,
        })),
      ),
    );
  useEffect(() => {
    load();
  }, []);
  const role = async (u: AdminUser, role: Role) => {
    try {
      await api(`/users/${u.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setMessage(`Rol de ${u.name} actualizado.`);
      load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const status = async (u: AdminUser) => {
    try {
      await api(`/users/${u.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <DashboardLayout>
      <div className="page-title">
        <span className="eyebrow">Seguridad y acceso</span>
        <h1>Usuarios y roles</h1>
        <p>
          Gestiona estudiantes y administradores. Los SUPER_ADMIN están
          protegidos.
        </p>
      </div>
      {message && <div className="alert">{message}</div>}
      <section className="panel table-wrap">
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
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  <small>{u.email}</small>
                </td>
                <td>
                  <span
                    className={`badge ${u.role === "SUPER_ADMIN" ? "super" : ""}`}
                  >
                    {u.role}
                  </span>
                </td>
                <td>
                  {u.isActive ? (
                    <span className="status active">
                      <CheckCircle2 />
                      Activo
                    </span>
                  ) : (
                    <span className="status">
                      <Ban />
                      Inactivo
                    </span>
                  )}
                </td>
                <td>
                  {u.role === "SUPER_ADMIN" ? (
                    <span className="locked">
                      <Shield />
                      Protegido
                    </span>
                  ) : (
                    <div className="row-actions">
                      <select
                        value={u.role}
                        onChange={(e) => role(u, e.target.value as Role)}
                      >
                        <option value="STUDENT">STUDENT</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                      <button
                        className="table-action"
                        onClick={() => status(u)}
                      >
                        {u.isActive ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </DashboardLayout>
  );
}
export function Forbidden() {
  const { user } = useAuth();
  return (
    <>
      <PublicHeader />
      <main className="forbidden">
        <span>403</span>
        <Shield />
        <h1>Acceso no autorizado</h1>
        <p>Tu cuenta no tiene permisos para ver esta página.</p>
        <Link className="button" to={user ? dashboardFor(user.role) : "/login"}>
          Volver a mi panel
        </Link>
      </main>
    </>
  );
}
