import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  Filter,
  GraduationCap,
  Palette,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PublicHeader } from "../components/Layout";
import { api } from "../services/api";
import type { Course } from "../types";

type Category = { id: string; name: string; slug: string };
type PublicMetrics = {
  students: number;
  courses: number;
  rating: string | number;
  enrollments: number;
};
const levels: Record<string, string> = {
  BEGINNER: "Inicial",
  INTERMEDIATE: "Intermedio",
  ADVANCED: "Avanzado",
};
const categoryIcons: Record<string, typeof Code2> = {
  desarrollo: Code2,
  diseno: Palette,
  negocios: BriefcaseBusiness,
  marketing: BarChart3,
};

export function Catalog() {
  const [params, setParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [metrics, setMetrics] = useState<PublicMetrics>({
    students: 0,
    courses: 0,
    rating: 0,
    enrollments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = params.get("search") ?? "";
  const category = params.get("category") ?? "";
  const level = params.get("level") ?? "";
  const sort = params.get("sort") ?? "popular";
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  useEffect(() => {
    Promise.all([
      api<Category[]>("/courses/categories"),
      api<{ metrics: PublicMetrics }>("/content/home"),
    ])
      .then(([categoryRows, home]) => {
        setCategories(categoryRows.data);
        setMetrics(home.data.metrics);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(
      () =>
        api<Course[]>(
          `/courses?search=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&level=${level}`,
        )
          .then((r) => {
            setCourses(r.data);
            setError("");
          })
          .catch((e) => setError(e.message))
          .finally(() => setLoading(false)),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [query, category, level]);
  const sorted = useMemo(
    () =>
      [...courses].sort((a, b) =>
        sort === "price-low"
          ? Number(a.price) - Number(b.price)
          : sort === "price-high"
            ? Number(b.price) - Number(a.price)
            : sort === "newest"
              ? String(b.id).localeCompare(String(a.id))
              : (b.enrollment_count ?? 0) - (a.enrollment_count ?? 0),
      ),
    [courses, sort],
  );
  const activeCount = [category, level].filter(Boolean).length;
  return (
    <div className="catalog-v2">
      <PublicHeader />
      <main>
        <section className="catalog-hero">
          <div className="catalog-orb one" />
          <div className="catalog-orb two" />
          <div className="catalog-hero-copy">
            <span>
              <Sparkles />
              Catálogo AulaFlow
            </span>
            <h1>
              Aprende hoy. <em>Transforma tu mañana.</em>
            </h1>
            <p>
              Encuentra cursos prácticos diseñados para ayudarte a dominar
              nuevas habilidades y avanzar profesionalmente.
            </p>
            <label className="catalog-search">
              <Search />
              <input
                value={query}
                onChange={(e) => update("search", e.target.value)}
                placeholder="¿Qué quieres aprender?"
              />
              {query && (
                <button
                  onClick={() => update("search", "")}
                  aria-label="Limpiar búsqueda"
                >
                  <X />
                </button>
              )}
              <Link to="#results">Buscar cursos</Link>
            </label>
            <div className="catalog-trust">
              <span>
                <CheckCircle2 />
                Profesores expertos
              </span>
              <span>
                <CheckCircle2 />
                Acceso a tu ritmo
              </span>
              <span>
                <CheckCircle2 />
                Progreso guardado
              </span>
            </div>
          </div>
          <div className="catalog-hero-art">
            <div className="orbit-ring">
              <div>
                <BookOpen />
              </div>
              <i className="orbit-dot dot-a">
                <Code2 />
              </i>
              <i className="orbit-dot dot-b">
                <Palette />
              </i>
              <i className="orbit-dot dot-c">
                <BarChart3 />
              </i>
            </div>
            <div className="catalog-float-card">
              <div>
                <GraduationCap />
              </div>
              <span>
                <strong>{metrics.courses} cursos</strong>
                {metrics.enrollments} inscripciones registradas
              </span>
            </div>
            <div className="catalog-rating">
              <Star />
              <strong>{Number(metrics.rating).toFixed(1)}</strong>
              <span>valoración media</span>
            </div>
          </div>
        </section>
        <section className="catalog-categories">
          <div className="catalog-section-title">
            <div>
              <span>Explora por área</span>
              <h2>Elige dónde comenzar</h2>
            </div>
            <button
              className={!category ? "active" : ""}
              onClick={() => update("category", "")}
            >
              Ver todas
            </button>
          </div>
          <div className="catalog-category-grid">
            {categories.map((cat) => {
              const Icon = categoryIcons[cat.slug] ?? BookOpen;
              return (
                <button
                  className={category === cat.slug ? "active" : ""}
                  key={cat.id}
                  onClick={() =>
                    update("category", category === cat.slug ? "" : cat.slug)
                  }
                >
                  <i>
                    <Icon />
                  </i>
                  <span>
                    <strong>{cat.name}</strong>
                    <small>Explorar cursos</small>
                  </span>
                  <ArrowRight />
                </button>
              );
            })}
          </div>
        </section>
        <section className="catalog-results" id="results">
          <div className="results-toolbar">
            <div>
              <span>Cursos disponibles</span>
              <h2>
                {loading
                  ? "Buscando…"
                  : `${sorted.length} ${sorted.length === 1 ? "curso encontrado" : "cursos encontrados"}`}
              </h2>
            </div>
            <div className="toolbar-actions">
              <button
                className="mobile-filter"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                <Filter />
                Filtros{activeCount > 0 && <i>{activeCount}</i>}
              </button>
              <label>
                Ordenar por
                <select
                  value={sort}
                  onChange={(e) => update("sort", e.target.value)}
                >
                  <option value="popular">Más populares</option>
                  <option value="newest">Más recientes</option>
                  <option value="price-low">Menor precio</option>
                  <option value="price-high">Mayor precio</option>
                </select>
                <ChevronDown />
              </label>
            </div>
          </div>
          <div className="catalog-layout">
            <aside
              className={
                filtersOpen ? "catalog-filters open" : "catalog-filters"
              }
            >
              <div className="filter-head">
                <strong>
                  <SlidersHorizontal />
                  Filtros
                </strong>
                {activeCount > 0 && (
                  <button
                    onClick={() => {
                      update("category", "");
                      update("level", "");
                    }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <div className="filter-group">
                <strong>Categoría</strong>
                <label>
                  <input
                    type="radio"
                    checked={!category}
                    onChange={() => update("category", "")}
                  />
                  <span>Todos los cursos</span>
                </label>
                {categories.map((cat) => (
                  <label key={cat.id}>
                    <input
                      type="radio"
                      checked={category === cat.slug}
                      onChange={() => update("category", cat.slug)}
                    />
                    <span>{cat.name}</span>
                  </label>
                ))}
              </div>
              <div className="filter-group">
                <strong>Nivel</strong>
                {Object.entries(levels).map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      checked={level === value}
                      onChange={() =>
                        update("level", level === value ? "" : value)
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div className="filter-promo">
                <Sparkles />
                <strong>¿No sabes por dónde empezar?</strong>
                <p>Crea una cuenta y descubre rutas recomendadas para ti.</p>
                <Link to="/register">
                  Comenzar gratis <ArrowRight />
                </Link>
              </div>
            </aside>
            <div className="catalog-content">
              {loading ? (
                <div className="catalog-loading">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i}>
                      <span />
                      <i />
                      <b />
                      <small />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="catalog-empty error">
                  <BookOpen />
                  <h3>No pudimos cargar los cursos</h3>
                  <p>{error}</p>
                </div>
              ) : sorted.length ? (
                <div className="catalog-course-grid">
                  {sorted.map((course) => (
                    <CatalogCard course={course} key={course.id} />
                  ))}
                </div>
              ) : (
                <div className="catalog-empty">
                  <Search />
                  <h3>No encontramos coincidencias</h3>
                  <p>Prueba con otra palabra, categoría o nivel.</p>
                  <button onClick={() => setParams({})}>
                    Ver todos los cursos
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
        <section className="catalog-bottom-cta">
          <div>
            <Sparkles />
            <span>El aprendizaje que buscas está a un clic</span>
          </div>
          <h2>¿Listo para empezar a crecer?</h2>
          <p>Crea tu cuenta gratis, inscríbete y aprende a tu propio ritmo.</p>
          <Link to="/register">
            Crear cuenta gratis <ArrowRight />
          </Link>
        </section>
      </main>
    </div>
  );
}

function CatalogCard({ course }: { course: Course }) {
  const reviews = course.review_count ?? 0;
  return (
    <article className="catalog-card">
      <Link className="catalog-card-image" to={`/courses/${course.slug}`}>
        <img src={course.image_url ?? ""} alt="" />
        <span>{course.category_name ?? "Curso"}</span>
        {Number(course.price) === 0 && <i>Gratis</i>}
        <div className="image-overlay">
          <BookOpen />
          Ver contenido
        </div>
      </Link>
      <div className="catalog-card-body">
        <div className="card-rating">
          <span>
            <Star />
            {reviews ? Number(course.rating).toFixed(1) : "Nuevo"}
          </span>
          <small>({course.enrollment_count ?? 0} estudiantes)</small>
        </div>
        <Link to={`/courses/${course.slug}`}>
          <h3>{course.title}</h3>
        </Link>
        <p>{course.description}</p>
        <div className="catalog-instructor">
          <i>
            {course.instructor
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </i>
          <span>
            Por <strong>{course.instructor}</strong>
          </span>
        </div>
        <div className="catalog-card-meta">
          <span>
            <Clock3 />
            {Math.max(Math.round(course.duration_minutes / 60), 1)} horas
          </span>
          <span>
            <Users />
            {levels[course.level]}
          </span>
        </div>
        <div className="catalog-card-foot">
          <strong>
            {Number(course.price) === 0 ? "Gratis" : `$${course.price}`}
          </strong>
          <Link to={`/courses/${course.slug}`}>
            Ver curso <ArrowRight />
          </Link>
        </div>
      </div>
    </article>
  );
}
