import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { api, sessionToken } from "../shared/api/client";

type ForgotResponse = { resetToken?: string };

function RecoveryLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-recovery-page">
      <Link className="recovery-brand" to="/">
        <i><BookOpen /></i>
        <strong>Aula<span>Flow</span></strong>
      </Link>
      <section className="recovery-card">{children}</section>
      <p className="recovery-security">
        <ShieldCheck /> Tus datos están protegidos y el enlace expira en 30 minutos.
      </p>
    </main>
  );
}

export function ForgotPasswordPage() {
  const location = useLocation();
  const initialEmail = (location.state as { email?: string } | null)?.email;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [demoToken, setDemoToken] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await api<ForgotResponse | undefined>(
        "/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email: String(form.get("email")) }),
        },
      );
      setDemoToken(response.data?.resetToken ?? "");
      setSent(true);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <RecoveryLayout>
      {sent ? (
        <div className="recovery-result" aria-live="polite">
          <i><CheckCircle2 /></i>
          <span>SOLICITUD RECIBIDA</span>
          <h1>Revisa tu correo</h1>
          <p>
            Si existe una cuenta con ese correo, recibirás un enlace para crear
            una nueva contraseña.
          </p>
          {demoToken && (
            <Link
              className="recovery-primary"
              to={`/reset-password?token=${encodeURIComponent(demoToken)}`}
            >
              Continuar en esta demo <ArrowRight />
            </Link>
          )}
          <button type="button" onClick={() => setSent(false)}>
            Probar con otro correo
          </button>
        </div>
      ) : (
        <>
          <div className="recovery-icon"><Mail /></div>
          <span className="recovery-overline">RECUPERA TU ACCESO</span>
          <h1>¿Olvidaste tu contraseña?</h1>
          <p>
            Escribe el correo asociado a tu cuenta y te enviaremos las
            instrucciones para restablecerla.
          </p>
          <form onSubmit={submit}>
            <label htmlFor="recovery-email">Correo electrónico</label>
            <div className="recovery-input">
              <Mail />
              <input
                id="recovery-email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={initialEmail}
                placeholder="tu@email.com"
                required
                autoFocus
              />
            </div>
            {error && <div className="recovery-error" role="alert">{error}</div>}
            <button className="recovery-primary" disabled={busy}>
              {busy ? "Enviando…" : "Enviar instrucciones"}
              {!busy && <ArrowRight />}
            </button>
          </form>
          <Link className="recovery-back" to="/login">
            <ArrowLeft /> Volver a iniciar sesión
          </Link>
        </>
      )}
    </RecoveryLayout>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirmation = String(form.get("confirmation"));
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (token.length !== 64) {
      setError("El enlace de recuperación no es válido o está incompleto.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      sessionToken.clear();
      setComplete(true);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <RecoveryLayout>
      {complete ? (
        <div className="recovery-result" aria-live="polite">
          <i><CheckCircle2 /></i>
          <span>CONTRASEÑA ACTUALIZADA</span>
          <h1>Ya puedes volver</h1>
          <p>
            Tu nueva contraseña fue guardada. Inicia sesión para continuar en AulaFlow.
          </p>
          <Link className="recovery-primary" to="/login">
            Iniciar sesión <ArrowRight />
          </Link>
        </div>
      ) : (
        <>
          <div className="recovery-icon"><KeyRound /></div>
          <span className="recovery-overline">NUEVA CONTRASEÑA</span>
          <h1>Protege tu cuenta</h1>
          <p>
            Usa al menos 8 caracteres. Te recomendamos combinar letras,
            números y símbolos.
          </p>
          <form onSubmit={submit}>
            <label htmlFor="new-password">Nueva contraseña</label>
            <div className="recovery-input">
              <LockKeyhole />
              <input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                autoFocus
              />
            </div>
            <label htmlFor="confirm-password">Confirmar contraseña</label>
            <div className="recovery-input">
              <LockKeyhole />
              <input
                id="confirm-password"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
              />
            </div>
            {error && <div className="recovery-error" role="alert">{error}</div>}
            <button className="recovery-primary" disabled={busy || !token}>
              {busy ? "Actualizando…" : "Guardar nueva contraseña"}
              {!busy && <ArrowRight />}
            </button>
          </form>
          {!token && (
            <div className="recovery-error" role="alert">
              Este enlace no contiene un token. Solicita uno nuevo.
            </div>
          )}
          <Link className="recovery-back" to="/forgot-password">
            Solicitar otro enlace
          </Link>
        </>
      )}
    </RecoveryLayout>
  );
}
