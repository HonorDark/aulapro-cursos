import {
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FeedbackContext,
  type ConfirmOptions,
  type FeedbackContextValue,
  type FeedbackType,
} from "./feedback-context";

type Toast = {
  id: number;
  type: FeedbackType;
  title: string;
  message?: string;
};
type ConfirmState = ConfirmOptions & { resolve: (accepted: boolean) => void };

function ToastIcon({ type }: { type: FeedbackType }) {
  if (type === "success") return <CheckCircle2 />;
  if (type === "error") return <XCircle />;
  if (type === "warning") return <TriangleAlert />;
  return <Info />;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const sequence = useRef(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmState | null>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (type: FeedbackType, title: string, message?: string) => {
      const id = ++sequence.current;
      setToasts((items) => [...items.slice(-3), { id, type, title, message }]);
      window.setTimeout(() => dismiss(id), type === "error" ? 6500 : 4500);
    },
    [dismiss],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) =>
        setConfirmation({ ...options, resolve }),
      ),
    [],
  );

  const answer = (accepted: boolean) => {
    confirmation?.resolve(accepted);
    setConfirmation(null);
  };
  const value = useMemo<FeedbackContextValue>(
    () => ({
      notify,
      success: (title, message) => notify("success", title, message),
      error: (title, message) => notify("error", title, message),
      warning: (title, message) => notify("warning", title, message),
      info: (title, message) => notify("info", title, message),
      confirm,
    }),
    [confirm, notify],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="feedback-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <article className={`feedback-toast ${toast.type}`} key={toast.id}>
            <i>
              <ToastIcon type={toast.type} />
            </i>
            <div>
              <strong>{toast.title}</strong>
              {toast.message && <p>{toast.message}</p>}
            </div>
            <button onClick={() => dismiss(toast.id)} aria-label="Cerrar aviso">
              <X />
            </button>
          </article>
        ))}
      </div>
      {confirmation && (
        <div className="feedback-confirm-backdrop" role="presentation">
          <section
            className={`feedback-confirm ${confirmation.tone ?? "primary"}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="feedback-confirm-title"
          >
            <i>
              <TriangleAlert />
            </i>
            <span>CONFIRMA ESTA ACCIÓN</span>
            <h2 id="feedback-confirm-title">{confirmation.title}</h2>
            <p>{confirmation.message}</p>
            <footer>
              <button onClick={() => answer(false)}>
                {confirmation.cancelLabel ?? "Cancelar"}
              </button>
              <button onClick={() => answer(true)}>
                {confirmation.confirmLabel ?? "Confirmar"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
