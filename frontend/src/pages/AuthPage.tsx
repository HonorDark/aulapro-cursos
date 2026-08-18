import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dashboardFor } from "../components/Routes";
import { useAuth } from "../context/AuthContext";

const demos = [
  {
    label: "Estudiante",
    email: "student@aulapro.test",
    password: "Estudiante123!",
    icon: GraduationCap,
  },
  {
    label: "Administrador",
    email: "admin@aulapro.test",
    password: "Admin123!",
    icon: KeyRound,
  },
  {
    label: "Super Admin",
    email: "superadmin@aulapro.test",
    password: "SuperAdmin123!",
    icon: LockKeyhole,
  },
];

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [demo, setDemo] = useState<{ email: string; password: string } | null>(
    null,
  );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const user =
        mode === "login"
          ? await login(String(form.get("email")), String(form.get("password")))
          : await register(
              String(form.get("name")),
              String(form.get("email")),
              String(form.get("password")),
            );
      navigate(dashboardFor(user.role));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-v2">
      <section className="auth-showcase">
        <div className="auth-glow one" />
        <div className="auth-glow two" />
        <Link className="auth-brand" to="/">
          <i>
            <BookOpen />
          </i>
          <strong>
            Aula<span>Flow</span>
          </strong>
        </Link>
        <div className="showcase-copy">
          <span>
            <Sparkles />
            Aprendizaje que transforma
          </span>
          <h1>Tu próxima habilidad empieza aquí.</h1>
          <p>
            Aprende con cursos prácticos, profesionales expertos y una
            experiencia diseñada para mantenerte avanzando.
          </p>
          <ul>
            <li>
              <i>
                <Check />
              </i>
              Acceso a contenido de alta calidad
            </li>
            <li>
              <i>
                <Check />
              </i>
              Progreso guardado automáticamente
            </li>
            <li>
              <i>
                <Check />
              </i>
              Aprende desde cualquier dispositivo
            </li>
          </ul>
        </div>
        <div className="auth-social-proof">
          <div>
            <i>LM</i>
            <i>CV</i>
            <i>AT</i>
          </div>
          <p>
            <strong>Comunidad AulaFlow</strong>
            <span>aprende y avanza con nosotros</span>
          </p>
        </div>
        <small>© 2026 AulaFlow · Educación para avanzar</small>
      </section>
      <section className="auth-form-side">
        <Link className="back-home" to="/">
          <ArrowLeft />
          Volver al inicio
        </Link>
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand">
            <BookOpen />
            Aula<span>Flow</span>
          </div>
          <span className="auth-overline">
            {mode === "login" ? "Bienvenido de nuevo" : "Únete a AulaFlow"}
          </span>
          <h2>
            {mode === "login"
              ? "Continúa aprendiendo"
              : "Crea tu cuenta gratis"}
          </h2>
          <p>
            {mode === "login"
              ? "Ingresa tus datos para volver a tu panel."
              : "Empieza hoy y descubre una nueva forma de aprender."}
          </p>
          <div className="auth-tabs">
            <Link className={mode === "login" ? "active" : ""} to="/login">
              Iniciar sesión
            </Link>
            <Link
              className={mode === "register" ? "active" : ""}
              to="/register"
            >
              Crear cuenta
            </Link>
          </div>
          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                <span>Nombre completo</span>
                <div className="auth-input">
                  <UserRound />
                  <input
                    name="name"
                    placeholder="Ej. Sofía Ramírez"
                    required
                    minLength={2}
                  />
                </div>
              </label>
            )}
            <label>
              <span>Correo electrónico</span>
              <div className="auth-input">
                <Mail />
                <input
                  name="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={demo?.email}
                  onChange={(e) =>
                    setDemo({
                      email: e.target.value,
                      password: demo?.password ?? "",
                    })
                  }
                  required
                />
              </div>
            </label>
            <label>
              <span>Contraseña</span>
              <div className="auth-input">
                <LockKeyhole />
                <input
                  name="password"
                  type={visible ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  value={demo?.password}
                  onChange={(e) =>
                    setDemo({
                      email: demo?.email ?? "",
                      password: e.target.value,
                    })
                  }
                  required
                  minLength={mode === "register" ? 8 : 1}
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={
                    visible ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {visible ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>
            {mode === "login" && (
              <div className="auth-options">
                <label>
                  <input type="checkbox" />
                  Recordarme
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setError(
                      "La recuperación está preparada mediante token en la API.",
                    )
                  }
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? (
                "Procesando…"
              ) : mode === "login" ? (
                <>
                  Entrar a mi cuenta <ArrowRight />
                </>
              ) : (
                <>
                  Crear mi cuenta <ArrowRight />
                </>
              )}
            </button>
          </form>
          {mode === "login" && (
            <>
              <div className="demo-divider">
                <span>o prueba una cuenta demo</span>
              </div>
              <div className="demo-users">
                {demos.map(({ label, email, password, icon: Icon }) => (
                  <button
                    key={email}
                    type="button"
                    onClick={() => setDemo({ email, password })}
                  >
                    <i>
                      <Icon />
                    </i>
                    <span>
                      <strong>{label}</strong>
                      <small>Acceso de demostración</small>
                    </span>
                    <ArrowRight />
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="auth-switch">
            {mode === "login" ? (
              <>
                ¿Aún no tienes cuenta?{" "}
                <Link to="/register">Regístrate gratis</Link>
              </>
            ) : (
              <>
                ¿Ya eres parte de AulaFlow?{" "}
                <Link to="/login">Inicia sesión</Link>
              </>
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
