import {
  Archive,
  ExternalLink,
  Eye,
  EyeOff,
  File,
  FileText,
  FolderOpen,
  Link as LinkIcon,
  Pencil,
  Plus,
  Save,
  Search,
  Video,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { api } from "../../../services/api";
import { normalizeSearchText } from "../../../shared/utils/text";
import { useFeedback } from "../../notifications/feedback-context";
import type {
  CourseResource,
  CourseResourceFormValues,
  CourseResourceType,
} from "../types";
import "../course-resources.css";

const resourceLabels: Record<CourseResourceType, string> = {
  LINK: "Enlace",
  PDF: "Documento PDF",
  VIDEO: "Video",
  FILE: "Archivo",
};

function ResourceIcon({ type }: { type: CourseResourceType }) {
  if (type === "PDF") return <FileText />;
  if (type === "VIDEO") return <Video />;
  if (type === "FILE") return <File />;
  return <LinkIcon />;
}

function resourcePayload(resource: CourseResource): CourseResourceFormValues {
  return {
    title: resource.title,
    description: resource.description,
    resourceType: resource.resource_type,
    url: resource.url,
    isPublished: resource.is_published,
  };
}

function ResourceModal({
  resource,
  saving,
  onClose,
  onSubmit,
}: {
  resource: CourseResource | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: CourseResourceFormValues) => Promise<boolean>;
}) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = await onSubmit({
      title: String(form.get("title") ?? "").trim(),
      description: String(form.get("description") ?? "").trim() || null,
      resourceType: String(form.get("resourceType")) as CourseResourceType,
      url: String(form.get("url") ?? "").trim(),
      isPublished: form.get("published") === "on",
    });
    if (saved) onClose();
  };

  return (
    <div
      className="editor-modal resource-editor-modal"
      role="presentation"
      onMouseDown={() => !saving && onClose()}
    >
      <form
        aria-labelledby="resource-modal-title"
        aria-modal="true"
        role="dialog"
        onSubmit={(event) => void submit(event)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>{resource ? "EDITAR RECURSO" : "NUEVO RECURSO"}</span>
            <h2 id="resource-modal-title">
              {resource ? "Actualiza el material" : "Comparte material adicional"}
            </h2>
            <p>El recurso estará asociado únicamente a este curso.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar formulario de recurso"
          >
            <X />
          </button>
        </header>
        <div className="resource-modal-fields">
          <label>
            Título
            <input
              name="title"
              defaultValue={resource?.title ?? ""}
              minLength={2}
              maxLength={180}
              autoFocus
              required
              placeholder="Ej. Guía de instalación"
            />
          </label>
          <label>
            Tipo de recurso
            <select
              name="resourceType"
              defaultValue={resource?.resource_type ?? "LINK"}
              required
            >
              {(Object.keys(resourceLabels) as CourseResourceType[]).map(
                (type) => (
                  <option value={type} key={type}>
                    {resourceLabels[type]}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        <label>
          URL del recurso
          <input
            name="url"
            type="url"
            defaultValue={resource?.url ?? ""}
            maxLength={3000}
            required
            placeholder="https://..."
          />
        </label>
        <label>
          Descripción
          <textarea
            name="description"
            defaultValue={resource?.description ?? ""}
            maxLength={1000}
            placeholder="Explica brevemente qué encontrará el estudiante."
          />
        </label>
        <label className="resource-publish-check">
          <input
            name="published"
            type="checkbox"
            defaultChecked={resource?.is_published ?? true}
          />
          <span>
            <strong>Visible para estudiantes</strong>
            Publica el recurso en el aula del curso.
          </span>
        </label>
        <button className="editor-save" disabled={saving}>
          <Save />
          {saving
            ? "Guardando recurso..."
            : resource
              ? "Guardar cambios"
              : "Crear recurso"}
        </button>
      </form>
    </div>
  );
}

export function CourseResourcesManager({
  courseId,
  courseTitle,
}: {
  courseId: string;
  courseTitle: string;
}) {
  const feedback = useFeedback();
  const [resources, setResources] = useState<CourseResource[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | CourseResourceType>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CourseResource | null>(null);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const basePath = `/management/courses/${courseId}/resources`;
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const response = await api<CourseResource[]>(basePath, { signal });
      if (!signal?.aborted) setResources(response.data);
    },
    [basePath],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void load(controller.signal)
      .catch((loadError: Error) => {
        if (loadError.name !== "AbortError") setError(loadError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load, reload]);

  const visibleResources = useMemo(() => {
    const term = normalizeSearchText(search);
    return resources.filter((resource) => {
      const matchesType = type === "ALL" || resource.resource_type === type;
      const matchesSearch =
        !term ||
        normalizeSearchText(
          `${resource.title} ${resource.description ?? ""} ${resource.url} ${resourceLabels[resource.resource_type]}`,
        ).includes(term);
      return matchesType && matchesSearch;
    });
  }, [resources, search, type]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (resource: CourseResource) => {
    setEditing(resource);
    setModalOpen(true);
  };

  const saveResource = async (values: CourseResourceFormValues) => {
    setSaving(true);
    try {
      const response = editing
        ? await api<CourseResource>(`${basePath}/${editing.id}`, {
            method: "PATCH",
            body: JSON.stringify(values),
          })
        : await api<CourseResource>(basePath, {
            method: "POST",
            body: JSON.stringify(values),
          });
      setResources((items) =>
        editing
          ? items.map((item) =>
              item.id === response.data.id ? response.data : item,
            )
          : [response.data, ...items],
      );
      feedback.success(
        editing ? "Recurso actualizado" : "Recurso creado",
        values.isPublished
          ? "Ya está disponible para los estudiantes del curso."
          : "Quedó guardado como no publicado.",
      );
      return true;
    } catch (saveError) {
      feedback.error("No se pudo guardar el recurso", (saveError as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (resource: CourseResource) => {
    setWorkingId(resource.id);
    try {
      const response = await api<CourseResource>(`${basePath}/${resource.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...resourcePayload(resource),
          isPublished: !resource.is_published,
        }),
      });
      setResources((items) =>
        items.map((item) =>
          item.id === response.data.id ? response.data : item,
        ),
      );
      feedback.success(
        resource.is_published ? "Recurso despublicado" : "Recurso publicado",
        resource.is_published
          ? "Dejó de estar visible para los estudiantes."
          : "Ahora aparece dentro del aula del curso.",
      );
    } catch (publishError) {
      feedback.error(
        "No se pudo cambiar la visibilidad",
        (publishError as Error).message,
      );
    } finally {
      setWorkingId(null);
    }
  };

  const archiveResource = async (resource: CourseResource) => {
    const accepted = await feedback.confirm({
      title: "Archivar recurso",
      message: `“${resource.title}” dejará de estar visible para estudiantes, pero conservarás su información para editarla o publicarla nuevamente.`,
      confirmLabel: "Archivar recurso",
      tone: "danger",
    });
    if (!accepted) return;
    setWorkingId(resource.id);
    try {
      await api(`${basePath}/${resource.id}`, { method: "DELETE" });
      setResources((items) =>
        items.map((item) =>
          item.id === resource.id ? { ...item, is_published: false } : item,
        ),
      );
      feedback.success(
        "Recurso archivado",
        "Se conserva en el editor y ya no es visible para estudiantes.",
      );
    } catch (archiveError) {
      feedback.error("No se pudo archivar", (archiveError as Error).message);
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <section className="course-resources-manager" aria-labelledby="resources-title">
      <header className="resources-manager-head">
        <div>
          <span>RECURSOS DEL CURSO</span>
          <h2 id="resources-title">Material complementario</h2>
          <p>
            Enlaces, documentos, videos y archivos disponibles en {courseTitle}.
          </p>
        </div>
        <div className="resource-summary">
          <span><strong>{resources.length}</strong> totales</span>
          <span><strong>{resources.filter((item) => item.is_published).length}</strong> publicados</span>
          <button type="button" onClick={openCreate}>
            <Plus /> Nuevo recurso
          </button>
        </div>
      </header>

      <div className="resource-toolbar">
        <label>
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por título, descripción o URL..."
            aria-label="Buscar recursos"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpiar búsqueda de recursos"
            >
              <X />
            </button>
          )}
        </label>
        <select
          value={type}
          onChange={(event) =>
            setType(event.target.value as "ALL" | CourseResourceType)
          }
          aria-label="Filtrar recursos por tipo"
        >
          <option value="ALL">Todos los tipos</option>
          {(Object.keys(resourceLabels) as CourseResourceType[]).map(
            (resourceType) => (
              <option value={resourceType} key={resourceType}>
                {resourceLabels[resourceType]}
              </option>
            ),
          )}
        </select>
        <span>{visibleResources.length} resultados</span>
      </div>

      {loading ? (
        <div className="resource-list-skeleton" aria-label="Cargando recursos">
          <i /><i /><i />
        </div>
      ) : error ? (
        <div className="resources-empty" role="alert">
          <FolderOpen />
          <strong>No pudimos cargar los recursos</strong>
          <span>{error}</span>
          <button type="button" onClick={() => setReload((value) => value + 1)}>
            Reintentar
          </button>
        </div>
      ) : visibleResources.length ? (
        <div className="resources-grid">
          {visibleResources.map((resource) => (
            <article
              className={`resource-card ${resource.is_published ? "published" : "draft"}`}
              key={resource.id}
            >
              <div className={`resource-type-icon ${resource.resource_type.toLowerCase()}`}>
                <ResourceIcon type={resource.resource_type} />
              </div>
              <div className="resource-card-content">
                <div className="resource-card-title">
                  <span>{resourceLabels[resource.resource_type]}</span>
                  <i className={resource.is_published ? "published" : "draft"}>
                    {resource.is_published ? "Publicado" : "No publicado"}
                  </i>
                </div>
                <h3>{resource.title}</h3>
                <p>{resource.description || "Sin descripción adicional."}</p>
                <a href={resource.url} target="_blank" rel="noreferrer">
                  <span>{resource.url}</span><ExternalLink />
                </a>
              </div>
              <footer>
                <button
                  type="button"
                  onClick={() => openEdit(resource)}
                  disabled={workingId === resource.id}
                >
                  <Pencil /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => void togglePublished(resource)}
                  disabled={workingId === resource.id}
                >
                  {resource.is_published ? <EyeOff /> : <Eye />}
                  {resource.is_published ? "Despublicar" : "Publicar"}
                </button>
                <button
                  type="button"
                  className="archive"
                  onClick={() => void archiveResource(resource)}
                  disabled={workingId === resource.id}
                  aria-label={`Archivar ${resource.title}`}
                >
                  <Archive />
                </button>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="resources-empty">
          <FolderOpen />
          <strong>
            {resources.length ? "No encontramos coincidencias" : "Aún no hay recursos"}
          </strong>
          <span>
            {resources.length
              ? "Prueba con otra búsqueda o cambia el tipo de recurso."
              : "Agrega el primer material complementario de este curso."}
          </span>
          {resources.length ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setType("ALL");
              }}
            >
              Limpiar filtros
            </button>
          ) : (
            <button type="button" onClick={openCreate}>
              <Plus /> Crear recurso
            </button>
          )}
        </div>
      )}

      {modalOpen && (
        <ResourceModal
          resource={editing}
          saving={saving}
          onClose={() => !saving && setModalOpen(false)}
          onSubmit={saveResource}
        />
      )}
    </section>
  );
}
