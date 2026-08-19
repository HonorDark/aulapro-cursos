import {
  Ban,
  Building2,
  Check,
  FolderCog,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { DashboardLayout } from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { useFeedback } from "../notifications/feedback-context";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  course_count: number;
};

type PaymentSettings = {
  bank_name: string;
  account_holder: string;
  account_number: string;
  account_type: string | null;
  currency: string;
  instructions: string | null;
  qr_image_url: string | null;
};

type Enrollment = {
  id: string;
  enrolled_at: string;
  access_status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  access_reason: string | null;
  student_name: string;
  student_email: string;
  course_title: string;
  payment_status: string | null;
};

type EnrollmentResponse = {
  items: Enrollment[];
  pagination: { page: number; limit: number; total: number };
};

type Tab = "enrollments" | "categories" | "bank";

export function SystemManagementPage({ initialTab = "enrollments" }: { initialTab?: Tab }) {
  const { user } = useAuth();
  const feedback = useFeedback();
  const isSuper = user?.role === "SUPER_ADMIN";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryEditor, setCategoryEditor] = useState<Category | "new" | null>(null);
  const [accessEditor, setAccessEditor] = useState<Enrollment | null>(null);

  const loadCategories = useCallback(async () => {
    const response = await api<Category[]>("/management/categories");
    setCategories(response.data);
  }, []);

  const loadSettings = useCallback(async () => {
    if (!isSuper) return;
    const response = await api<PaymentSettings>("/management/payment-settings");
    setSettings(response.data);
  }, [isSuper]);

  const loadEnrollments = useCallback(async () => {
    const response = await api<EnrollmentResponse>(
      `/management/enrollments?search=${encodeURIComponent(search)}&status=${status}&limit=100`,
    );
    setEnrollments(response.data.items);
    setTotal(response.data.pagination.total);
  }, [search, status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadCategories(), loadSettings(), loadEnrollments()]);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadEnrollments, loadSettings]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = categoryEditor === "new" ? null : categoryEditor;
    try {
      await api(
        current
          ? `/management/categories/${current.id}`
          : "/management/categories",
        {
          method: current ? "PATCH" : "POST",
          body: JSON.stringify({
            name: String(form.get("name")),
            slug: String(form.get("slug")),
            description: String(form.get("description")),
            isActive: form.get("isActive") === "on",
          }),
        },
      );
      setCategoryEditor(null);
      feedback.success(current ? "Categoría actualizada" : "Categoría creada");
      await loadCategories();
    } catch (saveError) {
      feedback.error("No se pudo guardar la categoría", (saveError as Error).message);
    }
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/management/payment-settings", {
        method: "PATCH",
        body: JSON.stringify({
          bankName: String(form.get("bankName")),
          accountHolder: String(form.get("accountHolder")),
          accountNumber: String(form.get("accountNumber")),
          accountType: String(form.get("accountType")),
          currency: String(form.get("currency")),
          instructions: String(form.get("instructions")),
          qrImageUrl: String(form.get("qrImageUrl")).trim() || null,
        }),
      });
      feedback.success("Datos bancarios actualizados");
      await loadSettings();
    } catch (saveError) {
      feedback.error("No se pudo guardar la configuración", (saveError as Error).message);
    }
  };

  const saveAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessEditor) return;
    const form = new FormData(event.currentTarget);
    try {
      await api(`/management/enrollments/${accessEditor.id}/access`, {
        method: "PATCH",
        body: JSON.stringify({
          status: String(form.get("status")),
          reason: String(form.get("reason")),
        }),
      });
      setAccessEditor(null);
      feedback.success("Acceso de inscripción actualizado");
      await loadEnrollments();
    } catch (saveError) {
      feedback.error("No se pudo cambiar el acceso", (saveError as Error).message);
    }
  };

  return (
    <DashboardLayout>
      <div className="system-management">
        <header className="system-management-head">
          <div>
            <span>CONFIGURACIÓN OPERATIVA</span>
            <h1>{isSuper ? "Administración del sistema" : "Inscripciones"}</h1>
            <p>Gestiona accesos, catálogo y configuración comercial sin modificar PostgreSQL manualmente.</p>
          </div>
          <i><ShieldCheck /></i>
        </header>

        <nav className="system-tabs" aria-label="Módulos de configuración">
          <button className={tab === "enrollments" ? "active" : ""} onClick={() => setTab("enrollments")}>
            <GraduationCap /> Inscripciones <b>{total}</b>
          </button>
          {isSuper && <button className={tab === "categories" ? "active" : ""} onClick={() => setTab("categories")}><FolderCog /> Categorías</button>}
          {isSuper && <button className={tab === "bank" ? "active" : ""} onClick={() => setTab("bank")}><Building2 /> Datos bancarios</button>}
        </nav>

        {error && <div className="management-error">{error}<button onClick={() => void load()}>Reintentar</button></div>}
        {loading ? <div className="page-state">Cargando configuración…</div> : (
          <>
            {tab === "enrollments" && (
              <section className="management-panel enrollment-management">
                <header>
                  <div><h2>Control de inscripciones</h2><p>Suspender o revocar no elimina progreso ni entregas.</p></div>
                  <form onSubmit={(event) => { event.preventDefault(); void loadEnrollments(); }}>
                    <label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Estudiante o curso" /></label>
                    <select value={status} onChange={(event) => setStatus(event.target.value)}>
                      <option value="">Todos los estados</option>
                      <option value="ACTIVE">Activas</option>
                      <option value="SUSPENDED">Suspendidas</option>
                      <option value="REVOKED">Revocadas</option>
                    </select>
                    <button type="submit">Buscar</button>
                  </form>
                </header>
                <div className="table-wrap"><table><thead><tr><th>Estudiante</th><th>Curso</th><th>Pago</th><th>Acceso</th><th>Alta</th>{isSuper && <th>Acción</th>}</tr></thead><tbody>
                  {enrollments.map((item) => <tr key={item.id}>
                    <td><strong>{item.student_name}</strong><small>{item.student_email}</small></td>
                    <td>{item.course_title}</td>
                    <td><span className={`management-badge ${(item.payment_status ?? "manual").toLowerCase()}`}>{item.payment_status ?? "Manual / gratis"}</span></td>
                    <td><span className={`management-badge ${item.access_status.toLowerCase()}`}>{item.access_status}</span>{item.access_reason && <small>{item.access_reason}</small>}</td>
                    <td>{new Date(item.enrolled_at).toLocaleDateString("es-BO")}</td>
                    {isSuper && <td><button className="management-edit" onClick={() => setAccessEditor(item)}><Pencil /> Cambiar</button></td>}
                  </tr>)}
                  {!enrollments.length && <tr><td colSpan={isSuper ? 6 : 5} className="management-empty">No hay inscripciones con estos filtros.</td></tr>}
                </tbody></table></div>
              </section>
            )}

            {tab === "categories" && isSuper && (
              <section className="management-panel category-management">
                <header><div><h2>Categorías del catálogo</h2><p>Organiza la oferta sin eliminar relaciones históricas.</p></div><button onClick={() => setCategoryEditor("new")}><Plus /> Nueva categoría</button></header>
                <div className="category-grid">{categories.map((category) => <article className={!category.is_active ? "inactive" : ""} key={category.id}>
                  <i><FolderCog /></i><div><strong>{category.name}</strong><span>/{category.slug}</span><p>{category.description || "Sin descripción"}</p><small>{category.course_count} cursos</small></div>
                  <button onClick={() => setCategoryEditor(category)}><Pencil /></button>
                </article>)}</div>
              </section>
            )}

            {tab === "bank" && isSuper && settings && (
              <section className="management-panel bank-management">
                <header><div><h2>Cuenta receptora y QR</h2><p>Esta información aparece en la pasarela de pago estudiantil.</p></div><Building2 /></header>
                <form onSubmit={saveSettings} key={settings.account_number}>
                  <label>Banco<input name="bankName" defaultValue={settings.bank_name} required /></label>
                  <label>Titular<input name="accountHolder" defaultValue={settings.account_holder} required /></label>
                  <label>Número de cuenta<input name="accountNumber" defaultValue={settings.account_number} required /></label>
                  <label>Tipo de cuenta<input name="accountType" defaultValue={settings.account_type ?? ""} /></label>
                  <label>Moneda<input name="currency" defaultValue={settings.currency} maxLength={10} required /></label>
                  <label className="wide">URL o imagen del QR<input name="qrImageUrl" defaultValue={settings.qr_image_url ?? ""} /></label>
                  <label className="wide">Instrucciones<textarea name="instructions" defaultValue={settings.instructions ?? ""} /></label>
                  <button type="submit"><Check /> Guardar configuración</button>
                </form>
              </section>
            )}
          </>
        )}

        {categoryEditor && (
          <div className="management-modal"><form onSubmit={saveCategory}>
            <header><div><span>CATÁLOGO</span><h2>{categoryEditor === "new" ? "Nueva categoría" : "Editar categoría"}</h2></div><button type="button" onClick={() => setCategoryEditor(null)}><X /></button></header>
            <label>Nombre<input name="name" defaultValue={categoryEditor === "new" ? "" : categoryEditor.name} required /></label>
            <label>Slug<input name="slug" pattern="[a-z0-9-]+" defaultValue={categoryEditor === "new" ? "" : categoryEditor.slug} required /></label>
            <label>Descripción<textarea name="description" defaultValue={categoryEditor === "new" ? "" : categoryEditor.description ?? ""} /></label>
            <label className="check"><input name="isActive" type="checkbox" defaultChecked={categoryEditor === "new" || categoryEditor.is_active} /> Categoría activa</label>
            <footer><button type="button" onClick={() => setCategoryEditor(null)}>Cancelar</button><button type="submit"><Check /> Guardar</button></footer>
          </form></div>
        )}

        {accessEditor && (
          <div className="management-modal"><form onSubmit={saveAccess}>
            <header><div><span>CONTROL DE ACCESO</span><h2>{accessEditor.student_name}</h2><p>{accessEditor.course_title}</p></div><button type="button" onClick={() => setAccessEditor(null)}><X /></button></header>
            <label>Estado<select name="status" defaultValue={accessEditor.access_status}><option value="ACTIVE">Activo</option><option value="SUSPENDED">Suspendido</option><option value="REVOKED">Revocado</option></select></label>
            <label>Motivo obligatorio<textarea name="reason" minLength={3} maxLength={500} required placeholder="Explica por qué se modifica el acceso" /></label>
            <aside><Ban /> El historial, progreso y entregas se conservarán.</aside>
            <footer><button type="button" onClick={() => setAccessEditor(null)}>Cancelar</button><button type="submit"><Check /> Aplicar cambio</button></footer>
          </form></div>
        )}
      </div>
    </DashboardLayout>
  );
}
