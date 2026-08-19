import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Landmark,
  Search,
  TrendingUp,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../components/Layout";
import { api } from "../../services/api";
import { useFeedback } from "../notifications/feedback-context";

type AccountingData = {
  currency: string;
  summary: {
    total_revenue: string | number;
    month_revenue: string | number;
    pending_amount: string | number;
    rejected_amount: string | number;
    approved_count: number;
    pending_count: number;
    rejected_count: number;
    average_ticket: string | number;
  };
  monthly: Array<{
    month_key: string;
    label: string;
    revenue: string | number;
    transactions: number;
  }>;
  courses: Array<{
    id: string;
    title: string;
    revenue: string | number;
    sales: number;
    pending_amount: string | number;
    pending_count: number;
  }>;
  movements: Array<{
    id: string;
    amount: string | number;
    status: "PENDING" | "APPROVED" | "REJECTED";
    payer_name: string;
    reference: string | null;
    paid_at: string;
    review_notes: string | null;
    reviewed_at: string | null;
    created_at: string;
    student_name: string;
    student_email: string;
    course_title: string;
    reviewer_name: string | null;
  }>;
};

const emptyData: AccountingData = {
  currency: "BOB",
  summary: {
    total_revenue: 0,
    month_revenue: 0,
    pending_amount: 0,
    rejected_amount: 0,
    approved_count: 0,
    pending_count: 0,
    rejected_count: 0,
    average_ticket: 0,
  },
  monthly: [],
  courses: [],
  movements: [],
};

const statusLabels = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

export function AccountingPage() {
  const feedback = useFeedback();
  const [data, setData] = useState<AccountingData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | keyof typeof statusLabels>("ALL");

  useEffect(() => {
    api<AccountingData>("/accounting")
      .then((response) => setData(response.data))
      .catch((error: Error) =>
        feedback.error("No pudimos cargar contabilidad", error.message),
      )
      .finally(() => setLoading(false));
  }, [feedback]);

  const money = (value: string | number) =>
    new Intl.NumberFormat("es-BO", {
      style: "currency",
      currency: data.currency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  const maxRevenue = Math.max(
    ...data.monthly.map((month) => Number(month.revenue)),
    1,
  );
  const totalTransactions =
    data.summary.approved_count +
    data.summary.pending_count +
    data.summary.rejected_count;
  const approvedPercent = totalTransactions
    ? Math.round((data.summary.approved_count * 100) / totalTransactions)
    : 0;
  const pendingPercent = totalTransactions
    ? Math.round((data.summary.pending_count * 100) / totalTransactions)
    : 0;
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return data.movements.filter(
      (movement) =>
        (status === "ALL" || movement.status === status) &&
        (!term ||
          `${movement.student_name} ${movement.student_email} ${movement.course_title} ${movement.reference ?? ""}`
            .toLocaleLowerCase("es")
            .includes(term)),
    );
  }, [data.movements, search, status]);

  return (
    <DashboardLayout>
      <div className="accounting-page">
        <header className="accounting-head">
          <div>
            <span>CONTROL FINANCIERO</span>
            <h1>Contabilidad</h1>
            <p>Ingresos basados únicamente en pagos aprobados y movimientos registrados.</p>
          </div>
          <Link to="/admin/payments"><CreditCard /> Revisar pagos pendientes</Link>
        </header>

        <section className="accounting-kpis">
          <article className="revenue"><i><Landmark /></i><div><span>Ingresos confirmados</span><strong>{money(data.summary.total_revenue)}</strong><small>{data.summary.approved_count} pagos aprobados</small></div></article>
          <article className="month"><i><TrendingUp /></i><div><span>Ingresos este mes</span><strong>{money(data.summary.month_revenue)}</strong><small>Según fecha de aprobación</small></div></article>
          <article className="pending"><i><Clock3 /></i><div><span>Pendiente por verificar</span><strong>{money(data.summary.pending_amount)}</strong><small>{data.summary.pending_count} operaciones</small></div></article>
          <article className="ticket"><i><WalletCards /></i><div><span>Ticket promedio</span><strong>{money(data.summary.average_ticket)}</strong><small>Promedio de pagos aprobados</small></div></article>
        </section>

        <div className="accounting-grid">
          <section className="accounting-card accounting-chart-card">
            <header><div><h2>Evolución de ingresos</h2><p>Pagos aprobados durante los últimos seis meses</p></div><span>6 meses</span></header>
            <div className="accounting-chart">
              {data.monthly.map((month) => (
                <article key={month.month_key}>
                  <div><span style={{ height: `${Math.max(4, (Number(month.revenue) * 100) / maxRevenue)}%` }}><b>{money(month.revenue)}</b></span></div>
                  <strong>{month.label}</strong>
                  <small>{month.transactions} pagos</small>
                </article>
              ))}
            </div>
          </section>

          <section className="accounting-card accounting-status-card">
            <header><div><h2>Estado de cobros</h2><p>{totalTransactions} movimientos registrados</p></div></header>
            <div className="accounting-donut" style={{ "--approved": `${approvedPercent * 3.6}deg`, "--pending": `${(approvedPercent + pendingPercent) * 3.6}deg` } as React.CSSProperties}><div><strong>{approvedPercent}%</strong><span>aprobados</span></div></div>
            <ul>
              <li><i className="approved" /><span>Aprobados</span><strong>{data.summary.approved_count}</strong></li>
              <li><i className="pending" /><span>Pendientes</span><strong>{data.summary.pending_count}</strong></li>
              <li><i className="rejected" /><span>Rechazados</span><strong>{data.summary.rejected_count}</strong></li>
            </ul>
          </section>

          <section className="accounting-card accounting-courses-card">
            <header><div><h2>Ingresos por curso</h2><p>Ventas confirmadas y montos pendientes</p></div></header>
            <div>
              {data.courses.map((course, index) => (
                <article key={course.id}>
                  <i>{index + 1}</i>
                  <div><strong>{course.title}</strong><span>{course.sales} ventas aprobadas · {course.pending_count} pendientes</span></div>
                  <p><strong>{money(course.revenue)}</strong><small>{course.pending_count ? `${money(course.pending_amount)} por verificar` : "Sin saldo pendiente"}</small></p>
                </article>
              ))}
              {!data.courses.length && <div className="accounting-empty"><Banknote /><p>Aún no existen movimientos por curso.</p></div>}
            </div>
          </section>
        </div>

        <section className="accounting-card accounting-movements">
          <header><div><h2>Libro de movimientos</h2><p>Trazabilidad de todos los comprobantes enviados</p></div><span>{visible.length} registros</span></header>
          <div className="accounting-tools">
            <label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar estudiante, referencia o curso..." /></label>
            <div>{(["ALL", "APPROVED", "PENDING", "REJECTED"] as const).map((value) => <button className={status === value ? "active" : ""} key={value} onClick={() => setStatus(value)}>{value === "ALL" ? "Todos" : statusLabels[value]}</button>)}</div>
          </div>
          <div className="accounting-table-wrap">
            <table>
              <thead><tr><th>Movimiento</th><th>Estudiante</th><th>Curso</th><th>Fecha del pago</th><th>Estado</th><th>Importe</th><th>Revisado por</th></tr></thead>
              <tbody>
                {visible.map((movement) => (
                  <tr key={movement.id}>
                    <td><span className={`movement-icon ${movement.status.toLowerCase()}`}>{movement.status === "APPROVED" ? <CheckCircle2 /> : movement.status === "REJECTED" ? <XCircle /> : <Clock3 />}</span><div><strong>{movement.reference || "Sin referencia"}</strong><small>{movement.payer_name}</small></div></td>
                    <td><strong>{movement.student_name}</strong><small>{movement.student_email}</small></td>
                    <td>{movement.course_title}</td>
                    <td>{new Date(movement.paid_at).toLocaleString("es-BO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td><span className={`accounting-badge ${movement.status.toLowerCase()}`}>{statusLabels[movement.status]}</span></td>
                    <td><strong>{money(movement.amount)}</strong></td>
                    <td>{movement.reviewer_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!visible.length && <div className="accounting-empty"><Search /><p>No hay movimientos con los filtros seleccionados.</p></div>}
          <footer><span>Los pagos pendientes y rechazados no se incluyen como ingresos.</span><Link to="/admin/payments">Administrar comprobantes <ArrowRight /></Link></footer>
        </section>
        {loading && <div className="accounting-loading">Actualizando información contable…</div>}
      </div>
    </DashboardLayout>
  );
}
