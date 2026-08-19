import {
  BadgeCheck,
  CalendarDays,
  Camera,
  IdCard,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { DashboardLayout } from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { useFeedback } from "../notifications/feedback-context";
import { api } from "../../services/api";
import type { Role } from "../../types";

type ProfileData = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  phone: string | null;
  documentNumber: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  birthDate: string | null;
  bio: string | null;
  isActive: boolean;
  createdAt: string;
};

const roleNames: Record<Role, string> = {
  STUDENT: "Estudiante",
  ADMIN: "Administrador",
  SUPER_ADMIN: "Superadministrador",
};

const countries = [
  "Bolivia",
  "Argentina",
  "Brasil",
  "Chile",
  "Colombia",
  "Ecuador",
  "Paraguay",
  "Perú",
  "Uruguay",
];

export function Profile() {
  const { refresh } = useAuth();
  const feedback = useFeedback();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError("");
    api<ProfileData>("/users/me", { signal: controller.signal })
      .then((response) => {
        if (!active) return;
        setProfile(response.data);
        setAvatar(response.data.avatarUrl);
      })
      .catch((error: Error) => {
        if (!active || error.name === "AbortError") return;
        setLoadError(error.message);
        feedback.error("No se pudo cargar el perfil", error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [feedback, reload]);

  const chooseAvatar = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return feedback.warning(
        "Formato no permitido",
        "Selecciona una imagen JPG, PNG o WEBP.",
      );
    }
    if (file.size > 1.5 * 1024 * 1024) {
      return feedback.warning(
        "Imagen demasiado grande",
        "La foto de perfil no puede superar 1.5 MB.",
      );
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const response = await api<ProfileData>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.get("name"),
          avatarUrl: avatar,
          phone: form.get("phone") || null,
          documentNumber: form.get("documentNumber") || null,
          country: form.get("country") || null,
          city: form.get("city") || null,
          address: form.get("address") || null,
          birthDate: form.get("birthDate") || null,
          bio: form.get("bio") || null,
        }),
      });
      setProfile(response.data);
      setAvatar(response.data.avatarUrl);
      await refresh();
      feedback.success(
        "Perfil actualizado",
        "Tus datos personales fueron guardados correctamente.",
      );
    } catch (error) {
      feedback.error("No se pudo guardar el perfil", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (form.get("new") !== form.get("confirm")) {
      return feedback.warning(
        "Las contraseñas no coinciden",
        "Repite exactamente la nueva contraseña.",
      );
    }
    setChangingPassword(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: form.get("current"),
          newPassword: form.get("new"),
        }),
      });
      formElement.reset();
      feedback.success(
        "Contraseña actualizada",
        "Tu cuenta ya está protegida con la nueva contraseña.",
      );
    } catch (error) {
      feedback.error(
        "No se pudo cambiar la contraseña",
        (error as Error).message,
      );
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="page-state">Cargando tu perfil...</div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="page-state" role="alert">
          <strong>No pudimos cargar tu perfil.</strong>
          <span>{loadError}</span>
          <button type="button" onClick={() => setReload((value) => value + 1)}>
            Reintentar
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const countryOptions = profile.country
    ? Array.from(new Set([profile.country, ...countries]))
    : countries;

  return (
    <DashboardLayout>
      <div className="profile-page">
        <header className="profile-hero">
          <div className="profile-avatar-large">
            {avatar ? (
              <img src={avatar} alt={`Foto de ${profile.name}`} />
            ) : (
              <span>{profile.name.charAt(0).toUpperCase()}</span>
            )}
            <label title="Cambiar foto">
              <Camera />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => chooseAvatar(event.target.files?.[0])}
              />
            </label>
          </div>
          <div>
            <span>MI CUENTA AULAFLOW</span>
            <h1>{profile.name}</h1>
            <p>
              <Mail /> {profile.email}
            </p>
          </div>
          <div className="profile-role-card">
            <ShieldCheck />
            <span>
              <small>ROL ACTUAL</small>
              <strong>{roleNames[profile.role]}</strong>
            </span>
            <i className={profile.isActive ? "active" : ""}>
              {profile.isActive ? "Cuenta activa" : "Cuenta inactiva"}
            </i>
          </div>
        </header>

        <div className="profile-layout">
          <form className="profile-information" onSubmit={saveProfile}>
            <header>
              <i>
                <UserRound />
              </i>
              <div>
                <span>INFORMACIÓN PERSONAL</span>
                <h2>Completa tu perfil</h2>
                <p>Estos datos identifican tu cuenta dentro de AulaFlow.</p>
              </div>
            </header>

            <div className="profile-fields">
              <label>
                Nombre completo
                <span>
                  <UserRound />
                  <input
                    name="name"
                    defaultValue={profile.name}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </span>
              </label>
              <label>
                Correo electrónico
                <span>
                  <Mail />
                  <input value={profile.email} disabled />
                </span>
              </label>
              <label>
                Número de teléfono
                <span>
                  <Phone />
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={profile.phone ?? ""}
                    maxLength={30}
                    placeholder="Ej. +591 70000000"
                  />
                </span>
              </label>
              <label>
                CI / documento de identidad
                <span>
                  <IdCard />
                  <input
                    name="documentNumber"
                    defaultValue={profile.documentNumber ?? ""}
                    maxLength={40}
                    placeholder="Ej. 1234567 LP"
                  />
                </span>
              </label>
              <label>
                País
                <span>
                  <MapPin />
                  <select name="country" defaultValue={profile.country ?? ""}>
                    <option value="">Seleccionar país</option>
                    {countryOptions.map((country) => (
                      <option value={country} key={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label>
                Ciudad
                <span>
                  <MapPin />
                  <input
                    name="city"
                    defaultValue={profile.city ?? ""}
                    maxLength={100}
                    placeholder="Ej. La Paz"
                  />
                </span>
              </label>
              <label>
                Fecha de nacimiento
                <span>
                  <CalendarDays />
                  <input
                    name="birthDate"
                    type="date"
                    defaultValue={profile.birthDate ?? ""}
                    max={new Date().toISOString().slice(0, 10)}
                  />
                </span>
              </label>
              <label className="profile-address">
                Dirección
                <span>
                  <MapPin />
                  <input
                    name="address"
                    defaultValue={profile.address ?? ""}
                    maxLength={220}
                    placeholder="Zona, avenida o calle"
                  />
                </span>
              </label>
              <label className="profile-bio">
                Acerca de mí
                <textarea
                  name="bio"
                  defaultValue={profile.bio ?? ""}
                  maxLength={500}
                  placeholder="Cuéntanos brevemente sobre ti, tus intereses o experiencia..."
                />
                <small>Máximo 500 caracteres</small>
              </label>
              <label className="profile-avatar-url">
                URL alternativa de la foto
                <input
                  type="url"
                  value={avatar?.startsWith("data:") ? "" : (avatar ?? "")}
                  onChange={(event) => setAvatar(event.target.value || null)}
                  placeholder="https://ejemplo.com/mi-foto.jpg"
                />
              </label>
            </div>
            <button className="profile-save" disabled={saving}>
              <Save /> {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>

          <aside className="profile-aside">
            <form className="profile-password" onSubmit={changePassword}>
              <header>
                <i>
                  <KeyRound />
                </i>
                <div>
                  <span>SEGURIDAD</span>
                  <h2>Cambiar contraseña</h2>
                </div>
              </header>
              <label>
                Contraseña actual
                <input name="current" type="password" required />
              </label>
              <label>
                Nueva contraseña
                <input name="new" type="password" minLength={8} required />
              </label>
              <label>
                Confirmar contraseña
                <input name="confirm" type="password" minLength={8} required />
              </label>
              <button disabled={changingPassword}>
                <KeyRound />
                {changingPassword ? "Actualizando..." : "Actualizar contraseña"}
              </button>
            </form>

            <section className="profile-account-summary">
              <header>
                <BadgeCheck />
                <h2>Resumen de la cuenta</h2>
              </header>
              <dl>
                <div>
                  <dt>Miembro desde</dt>
                  <dd>
                    {new Date(profile.createdAt).toLocaleDateString("es", {
                      month: "long",
                      year: "numeric",
                    })}
                  </dd>
                </div>
                <div>
                  <dt>Tipo de cuenta</dt>
                  <dd>{roleNames[profile.role]}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd className="active">Activa y verificada</dd>
                </div>
              </dl>
              <p>
                <ShieldCheck /> Tus datos personales solo son visibles para ti
                y administradores autorizados.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
