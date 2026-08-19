import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Check,
  Clock3,
  CreditCard,
  Eye,
  FileCheck2,
  FileUp,
  Landmark,
  ReceiptText,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../features/notifications/feedback-context";
import { api } from "../services/api";
import type { Course } from "../types";

type Settings = {
  bank_name: string;
  account_holder: string;
  account_number: string;
  account_type: string;
  currency: string;
  instructions: string;
  qr_image_url: string | null;
};
type Payment = {
  id: string;
  course_id?: string;
  amount: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  payer_name?: string;
  reference: string | null;
  paid_at: string;
  receipt_mime?: string;
  review_notes: string | null;
  reviewed_at?: string;
  created_at: string;
  title?: string;
  slug?: string;
  student_name?: string;
  student_email?: string;
  course_title?: string;
  reviewer_name?: string;
};
const statusText = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

export function PaymentCheckout() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const feedback = useFeedback();
  const [course, setCourse] = useState<Course | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [existing, setExisting] = useState<Payment | null>(null);
  const [receipt, setReceipt] = useState<{
    data: string;
    mime: string;
    name: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    Promise.all([
      api<Course>(`/courses/${courseId}`),
      api<Settings>("/payments/settings"),
      api<Payment[]>("/payments/mine"),
    ])
      .then(([c, s, p]) => {
        setCourse(c.data);
        setSettings(s.data);
        setExisting(
          p.data.find(
            (x) => x.course_id === c.data.id && x.status === "PENDING",
          ) ?? null,
        );
      })
      .catch((e) => setMessage(e.message));
  }, [courseId]);
  const choose = (file?: File) => {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        file.type,
      )
    ) {
      feedback.warning(
        "Formato no permitido",
        "Sube una imagen JPG, PNG, WEBP o un PDF.",
      );
      return setMessage("Sube una imagen JPG, PNG, WEBP o un PDF.");
    }
    if (file.size > 5 * 1024 * 1024) {
      feedback.warning(
        "Archivo demasiado grande",
        "El comprobante no puede superar 5 MB.",
      );
      return setMessage("El comprobante no puede superar 5 MB.");
    }
    const reader = new FileReader();
    reader.onload = () =>
      setReceipt({
        data: String(reader.result),
        mime: file.type,
        name: file.name,
      });
    reader.readAsDataURL(file);
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!receipt || !course) {
      feedback.warning(
        "Falta el comprobante",
        "Adjunta el archivo antes de enviar el pago.",
      );
      return setMessage("Debes adjuntar el comprobante de pago.");
    }
    const form = new FormData(e.currentTarget);
    setSending(true);
    try {
      const result = await api<Payment>("/payments", {
        method: "POST",
        body: JSON.stringify({
          courseId: course.id,
          payerName: form.get("payerName"),
          reference: form.get("reference"),
          paidAt: form.get("paidAt"),
          receiptData: receipt.data,
          receiptMime: receipt.mime,
        }),
      });
      setExisting({
        ...result.data,
        course_id: course.id,
        title: course.title,
        reference: String(form.get("reference") || ""),
        paid_at: String(form.get("paidAt")),
        review_notes: null,
      });
      setMessage("Comprobante enviado. Un administrador verificará el pago.");
      feedback.success(
        "Comprobante enviado",
        "Un administrador verificará tu pago y te notificará la decisión.",
      );
    } catch (error) {
      setMessage((error as Error).message);
      feedback.error("No se pudo enviar el pago", (error as Error).message);
    } finally {
      setSending(false);
    }
  };
  if (!course || !settings)
    return (
      <DashboardLayout>
        <div className="page-state">
          {message || "Preparando información de pago…"}
        </div>
      </DashboardLayout>
    );
  return (
    <DashboardLayout>
      <div className="payment-heading">
        <Link to={`/courses/${course.slug}`}>
          <ArrowLeft />
          Volver al curso
        </Link>
        <div className="checkout-progress">
          <span className="active">
            <i>1</i>Transferencia
          </span>
          <b />
          <span>
            <i>2</i>Comprobante
          </span>
          <b />
          <span>
            <i>3</i>Verificación
          </span>
        </div>
        <span>PAGO SEGURO Y VERIFICADO</span>
        <h1>Completa tu inscripción</h1>
        <p>
          Realiza la transferencia y adjunta el comprobante. Tu acceso se
          habilitará después de la verificación.
        </p>
      </div>
      {existing ? (
        <section className="payment-result">
          <i>
            <Clock3 />
          </i>
          <span>Comprobante recibido</span>
          <h2>Tu pago está pendiente de verificación</h2>
          <p>
            Normalmente revisamos los comprobantes dentro del horario
            administrativo. Te mostraremos el curso en “Mi aprendizaje” cuando
            sea aprobado.
          </p>
          <div>
            <strong>{course.title}</strong>
            <b>
              {settings.currency} {Number(existing.amount).toFixed(2)}
            </b>
          </div>
          <Link to="/student">Volver a mi panel</Link>
        </section>
      ) : (
        <div className="checkout-grid">
          <section className="bank-card">
            <header>
              <i>
                <Landmark />
              </i>
              <div>
                <span>Paso 1</span>
                <h2>Realiza la transferencia</h2>
              </div>
            </header>
            <div className="checkout-course">
              <img src={course.image_url ?? ""} alt="" />
              <div>
                <span>CURSO SELECCIONADO</span>
                <strong>{course.title}</strong>
                <small>Acceso completo después de la aprobación</small>
              </div>
            </div>
            <div className="qr-payment-box">
              <div className="qr-frame">
                <img
                  className="bank-qr"
                  src={settings.qr_image_url || "/aulaflow-payment-qr.png"}
                  alt="Código QR con datos bancarios"
                />
              </div>
              <div>
                <span>ESCANEA EL QR</span>
                <h3>Pago rápido desde tu banco</h3>
                <p>
                  Escanea el código con la aplicación de tu banco o utiliza los
                  datos de transferencia.
                </p>
                <small>
                  <BadgeCheck />
                  QR demostrativo de AulaFlow
                </small>
              </div>
            </div>
            <dl>
              <div>
                <dt>Banco</dt>
                <dd>{settings.bank_name}</dd>
              </div>
              <div>
                <dt>Titular</dt>
                <dd>{settings.account_holder}</dd>
              </div>
              <div>
                <dt>Número de cuenta</dt>
                <dd>{settings.account_number}</dd>
              </div>
              <div>
                <dt>Tipo de cuenta</dt>
                <dd>{settings.account_type}</dd>
              </div>
            </dl>
            <p>
              <AlertCircle />
              {settings.instructions}
            </p>
            <div className="pay-total">
              <span>
                <small>Total a transferir</small>
                <b>Pago único · acceso al curso</b>
              </span>
              <strong>
                {settings.currency} {Number(course.price).toFixed(2)}
              </strong>
            </div>
          </section>
          <form className="receipt-form" onSubmit={submit}>
            <header>
              <i>
                <ReceiptText />
              </i>
              <div>
                <span>Paso 2</span>
                <h2>Envía tu comprobante</h2>
              </div>
            </header>
            <div className="form-notice">
              <FileCheck2 />
              <div>
                <strong>Verificación manual y segura</strong>
                <span>
                  Comprobaremos el monto, la referencia y la cuenta de destino
                  antes de habilitar tu acceso.
                </span>
              </div>
            </div>
            <label>
              Nombre de quien realizó el pago
              <input
                name="payerName"
                defaultValue={user?.name}
                required
                minLength={3}
              />
            </label>
            <div className="receipt-row">
              <label>
                Fecha y hora del pago
                <input
                  name="paidAt"
                  type="datetime-local"
                  defaultValue={new Date(
                    Date.now() - new Date().getTimezoneOffset() * 60000,
                  )
                    .toISOString()
                    .slice(0, 16)}
                  required
                />
              </label>
              <label>
                Número de referencia
                <input name="reference" placeholder="Ej. 845721" />
              </label>
            </div>
            <label className={`receipt-drop ${receipt ? "selected" : ""}`}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => choose(e.target.files?.[0])}
              />
              {receipt ? (
                <>
                  <FileCheck2 />
                  <strong>{receipt.name}</strong>
                  <span>Comprobante listo para enviar</span>
                </>
              ) : (
                <>
                  <span className="upload-orbit">
                    <FileUp />
                  </span>
                  <strong>Arrastra o selecciona tu comprobante</strong>
                  <span>JPG, PNG, WEBP o PDF · máximo 5 MB</span>
                  <em>Seleccionar archivo</em>
                </>
              )}
            </label>
            {message && <div className="payment-message">{message}</div>}
            <button className="payment-submit" disabled={sending}>
              <Check />
              {sending ? "Enviando…" : "Enviar pago para verificar"}
            </button>
            <small>
              <BadgeCheck />
              Tu comprobante solo será visible para administradores autorizados.
            </small>
            <div className="payment-trust">
              <span>
                <Check />
                Datos protegidos
              </span>
              <span>
                <Clock3 />
                Revisión administrativa
              </span>
            </div>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}

export function AdminPayments() {
  const feedback = useFeedback();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Payment | null>(null);
  const [receipt, setReceipt] = useState<{
    receipt_data: string;
    receipt_mime: string;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [modalError, setModalError] = useState("");
  const load = () =>
    api<Payment[]>("/payments/admin").then((r) => setPayments(r.data));
  useEffect(() => {
    load().catch((e) => feedback.error("No se pudieron cargar los pagos", e.message));
  }, [feedback]);
  const totals = useMemo(
    () => ({
      pending: payments.filter((x) => x.status === "PENDING").length,
      approved: payments.filter((x) => x.status === "APPROVED").length,
      rejected: payments.filter((x) => x.status === "REJECTED").length,
      amount: payments
        .filter((x) => x.status === "PENDING")
        .reduce((s, x) => s + Number(x.amount), 0),
    }),
    [payments],
  );
  const visible = useMemo(
    () => (filter ? payments.filter((x) => x.status === filter) : payments),
    [payments, filter],
  );
  const inspect = async (payment: Payment) => {
    setSelected(payment);
    setNotes("");
    setModalError("");
    setReceipt(null);
    try {
      const r = await api<{ receipt_data: string; receipt_mime: string }>(
        `/payments/admin/${payment.id}/receipt`,
      );
      setReceipt(r.data);
    } catch (e) {
      setModalError((e as Error).message);
      feedback.error("No se pudo abrir el comprobante", (e as Error).message);
    }
  };
  const review = async (decision: "APPROVED" | "REJECTED") => {
    if (!selected) return;
    if (decision === "REJECTED" && notes.trim().length < 3) {
      feedback.warning(
        "Motivo obligatorio",
        "Escribe el motivo del rechazo antes de continuar.",
      );
      return setModalError("Escribe el motivo del rechazo antes de continuar.");
    }
    setModalError("");
    try {
      await api(`/payments/admin/${selected.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ decision, notes }),
      });
      setSelected(null);
      setReceipt(null);
      setFilter("");
      if (decision === "APPROVED") {
        feedback.success(
          "Pago aprobado",
          "La inscripción fue habilitada y el registro quedó en el historial.",
        );
      } else {
        feedback.warning(
          "Pago rechazado",
          "El estudiante recibirá el motivo y el registro seguirá en el historial.",
        );
      }
      await load();
    } catch (e) {
      setModalError((e as Error).message);
      feedback.error("No se pudo revisar el pago", (e as Error).message);
    }
  };
  return (
    <DashboardLayout>
      <div className="admin-pay-head">
        <div>
          <span>CONTROL FINANCIERO</span>
          <h1>Pagos</h1>
          <p>
            Bandeja de verificación e historial permanente de todas las
            operaciones.
          </p>
        </div>
        <div>
          <i>
            <CreditCard />
          </i>
          <span>
            <strong>{totals.pending}</strong>por revisar
          </span>
          <span>
            <strong>Bs {totals.amount.toFixed(2)}</strong>pendientes
          </span>
        </div>
      </div>
      <div className="payment-tabs">
        <button
          className={filter === "" ? "active" : ""}
          onClick={() => setFilter("")}
        >
          Todos <i>{payments.length}</i>
        </button>
        <button
          className={filter === "PENDING" ? "active" : ""}
          onClick={() => setFilter("PENDING")}
        >
          Por revisar <i>{totals.pending}</i>
        </button>
        <button
          className={filter === "APPROVED" ? "active" : ""}
          onClick={() => setFilter("APPROVED")}
        >
          Aprobados <i>{totals.approved}</i>
        </button>
        <button
          className={filter === "REJECTED" ? "active" : ""}
          onClick={() => setFilter("REJECTED")}
        >
          Rechazados <i>{totals.rejected}</i>
        </button>
      </div>
      <section className="payments-table">
        <header className="payments-list-head">
          <div>
            <strong>
              {filter
                ? statusText[filter as keyof typeof statusText]
                : "Historial completo"}
            </strong>
            <span>
              {visible.length}{" "}
              {visible.length === 1 ? "operación" : "operaciones"}
            </span>
          </div>
          <small>Los pagos revisados se conservan permanentemente</small>
        </header>
        <table>
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Curso</th>
              <th>Pago</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.student_name}</strong>
                  <small>{p.student_email}</small>
                </td>
                <td>{p.course_title}</td>
                <td>
                  <strong>Bs {Number(p.amount).toFixed(2)}</strong>
                  <small>Ref. {p.reference || "Sin referencia"}</small>
                </td>
                <td>{new Date(p.paid_at).toLocaleString("es")}</td>
                <td>
                  <span className={`pay-status ${p.status.toLowerCase()}`}>
                    {statusText[p.status]}
                  </span>
                </td>
                <td>
                  <button onClick={() => inspect(p)}>
                    <Eye />
                    {p.status === "PENDING" ? "Revisar" : "Ver detalle"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <div className="payments-empty">
            <Banknote />
            <h2>No hay pagos en esta sección</h2>
            <p>
              Puedes consultar las demás categorías sin perder el historial.
            </p>
          </div>
        )}
      </section>
      {selected && (
        <div className="receipt-modal">
          <div className="receipt-dialog">
            <header>
              <div>
                <span>VERIFICACIÓN DE PAGO</span>
                <h2>{selected.student_name}</h2>
                <p>
                  {selected.course_title} · Bs{" "}
                  {Number(selected.amount).toFixed(2)}
                </p>
              </div>
              <button onClick={() => setSelected(null)}>
                <X />
              </button>
            </header>
            <div className="receipt-preview">
              {!receipt ? (
                <span>Cargando comprobante…</span>
              ) : receipt.receipt_mime === "application/pdf" ? (
                <iframe src={receipt.receipt_data} title="Comprobante PDF" />
              ) : (
                <img src={receipt.receipt_data} alt="Comprobante de pago" />
              )}
            </div>
            <dl>
              <div>
                <dt>Pagador</dt>
                <dd>{selected.payer_name}</dd>
              </div>
              <div>
                <dt>Referencia</dt>
                <dd>{selected.reference || "No indicada"}</dd>
              </div>
              <div>
                <dt>Fecha declarada</dt>
                <dd>{new Date(selected.paid_at).toLocaleString("es")}</dd>
              </div>
            </dl>
            {selected.status === "PENDING" ? (
              <>
                <label>
                  Observación de la revisión
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Opcional al aprobar, obligatorio al rechazar"
                  />
                </label>
                {modalError && (
                  <div className="receipt-modal-error" role="alert">
                    <AlertCircle />
                    <span>{modalError}</span>
                  </div>
                )}
                <footer>
                  <button className="reject" onClick={() => review("REJECTED")}>
                    Rechazar pago
                  </button>
                  <button
                    className="approve"
                    onClick={() => review("APPROVED")}
                  >
                    <Check />
                    Confirmar y habilitar curso
                  </button>
                </footer>
              </>
            ) : (
              <div className={`reviewed-box ${selected.status.toLowerCase()}`}>
                Pago {statusText[selected.status].toLowerCase()}
                {selected.review_notes && <p>{selected.review_notes}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export function PaymentCorrections() {
  const feedback = useFeedback();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [notes, setNotes] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const load = () =>
    api<Payment[]>("/payments/admin").then((r) =>
      setPayments(r.data.filter((x) => x.status !== "PENDING")),
    );
  useEffect(() => {
    load().catch((e) =>
      feedback.error("No se pudieron cargar los pagos", e.message),
    );
  }, [feedback]);
  const change = async () => {
    if (!selected) return;
    if (notes.trim().length < 3) {
      setCorrectionError("Debes explicar el motivo de la corrección.");
      return feedback.warning(
        "Motivo obligatorio",
        "Explica por qué estás corrigiendo esta decisión.",
      );
    }
    setCorrectionError("");
    const decision = selected.status === "APPROVED" ? "REJECTED" : "APPROVED";
    try {
      await api(`/payments/admin/${selected.id}/revise`, {
        method: "PATCH",
        body: JSON.stringify({ decision, notes }),
      });
      feedback.success(
        "Decisión actualizada",
        `El pago cambió a ${statusText[decision].toLowerCase()} y la acción quedó auditada.`,
      );
      setSelected(null);
      setNotes("");
      await load();
    } catch (e) {
      setCorrectionError((e as Error).message);
      feedback.error("No se pudo corregir el pago", (e as Error).message);
    }
  };
  return (
    <DashboardLayout>
      <div className="admin-pay-head">
        <div>
          <span>SUPERADMINISTRACIÓN</span>
          <h1>Corrección de pagos</h1>
          <p>
            Modifica decisiones ya tomadas. Esta función está restringida al
            SUPER_ADMIN.
          </p>
        </div>
        <div>
          <i>
            <BadgeCheck />
          </i>
          <span>
            <strong>{payments.length}</strong>decisiones históricas
          </span>
        </div>
      </div>
      <section className="payments-table correction-table">
        <header className="payments-list-head">
          <div>
            <strong>Aprobados y rechazados</strong>
            <span>{payments.length} registros</span>
          </div>
          <small>Cada modificación queda registrada en auditoría</small>
        </header>
        <table>
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Curso</th>
              <th>Monto</th>
              <th>Decisión actual</th>
              <th>Revisado por</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.student_name}</strong>
                  <small>{p.student_email}</small>
                </td>
                <td>{p.course_title}</td>
                <td>Bs {Number(p.amount).toFixed(2)}</td>
                <td>
                  <span className={`pay-status ${p.status.toLowerCase()}`}>
                    {statusText[p.status]}
                  </span>
                </td>
                <td>{p.reviewer_name ?? "Sistema"}</td>
                <td>
                  <button
                    onClick={() => {
                      setSelected(p);
                      setNotes("");
                      setCorrectionError("");
                    }}
                  >
                    Corregir decisión
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!payments.length && (
          <div className="payments-empty">
            <FileCheck2 />
            <h2>No hay decisiones revisadas</h2>
          </div>
        )}
      </section>
      {selected && (
        <div className="correction-panel">
          <div>
            <span>CAMBIO RESTRINGIDO</span>
            <h2>{selected.student_name}</h2>
            <p>{selected.course_title}</p>
            <div className={`reviewed-box ${selected.status.toLowerCase()}`}>
              Estado actual: {statusText[selected.status]}
            </div>
            <label>
              Motivo obligatorio
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe por qué se corrige la decisión"
              />
            </label>
            {correctionError && (
              <div className="receipt-modal-error" role="alert">
                <AlertCircle />
                <span>{correctionError}</span>
              </div>
            )}
            <footer>
              <button onClick={() => setSelected(null)}>Cancelar</button>
              <button
                className={
                  selected.status === "APPROVED" ? "reject" : "approve"
                }
                onClick={change}
              >
                Cambiar a{" "}
                {selected.status === "APPROVED" ? "rechazado" : "aprobado"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
