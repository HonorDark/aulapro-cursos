import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Check,
  Code2,
  GraduationCap,
  Headphones,
  Layers3,
  LockKeyhole,
  Mail,
  Palette,
  Palette as Instagram,
  Play,
  Play as Youtube,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Users as Linkedin,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import heroImage from "../assets/aulaflow-hero-v2.png";
import { PublicHeader } from "../components/Layout";
import { api } from "../services/api";
import type { Course } from "../types";
import { CourseCard } from "../features/courses/components/CourseCard";

type Category = { id: string; name: string; slug: string; description: string };
type HomeContent = {
  instructors: Array<{
    name: string;
    role: string;
    initials: string;
    tone: string;
    rating: string | number;
    student_count: number;
  }>;
  testimonials: Array<{
    quote: string;
    name: string;
    role: string;
    initials: string;
  }>;
  metrics: {
    students: number;
    courses: number;
    rating: string | number;
    enrollments: number;
  };
};
const categoryLooks: Record<string, { icon: typeof Code2; tone: string }> = {
  desarrollo: { icon: Code2, tone: "purple" },
  diseno: { icon: Palette, tone: "blue" },
  negocios: { icon: BriefcaseBusiness, tone: "cyan" },
  marketing: { icon: BarChart3, tone: "pink" },
};

export function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [content, setContent] = useState<HomeContent>({
    instructors: [],
    testimonials: [],
    metrics: { students: 0, courses: 0, rating: 0, enrollments: 0 },
  });
  const [testimonial, setTestimonial] = useState(0);
  useEffect(() => {
    Promise.all([
      api<Course[]>("/courses"),
      api<Category[]>("/courses/categories"),
      api<HomeContent>("/content/home"),
    ])
      .then(([courseRows, categoryRows, home]) => {
        setCourses(courseRows.data.slice(0, 3));
        setCategories(categoryRows.data);
        setContent(home.data);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (content.testimonials.length < 2) return;
    const timer = window.setInterval(
      () =>
        setTestimonial(
          (current) => (current + 1) % content.testimonials.length,
        ),
      3000,
    );
    return () => window.clearInterval(timer);
  }, [content.testimonials.length]);
  return (
    <div className="home-v2">
      <PublicHeader />
      <main>
        <section className="home-hero">
          <div className="hero-orb orb-one" />
          <div className="hero-orb orb-two" />
          <div className="hero-copy">
            <span className="hero-kicker">
              <Sparkles />
              Tu futuro empieza aprendiendo
            </span>
            <h1>
              Aprende habilidades que <span>transforman</span> tu carrera.
            </h1>
            <p>
              Cursos prácticos creados por profesionales. Avanza a tu ritmo,
              demuestra tu progreso y construye el futuro que quieres.
            </p>
            <div className="hero-actions">
              <Link className="button home-primary" to="/courses">
                Explorar cursos <ArrowRight />
              </Link>
              <Link className="hero-watch" to="/register">
                <i>
                  <Play />
                </i>
                <span>
                  <strong>Comienza gratis</strong>
                  <small>Sin tarjeta de crédito</small>
                </span>
              </Link>
            </div>
            <div className="hero-proof">
              <div className="proof-avatars">
                {content.instructors.slice(0, 3).map((x) => (
                  <i key={x.name}>{x.initials}</i>
                ))}
                <i>+{content.metrics.students}</i>
              </div>
              <div>
                <span>
                  <Star />
                  <Star />
                  <Star />
                  <Star />
                  <Star />
                </span>
                <p>
                  <strong>{Number(content.metrics.rating).toFixed(1)}/5</strong>{" "}
                  por nuestra comunidad
                </p>
              </div>
            </div>
          </div>
          <div className="hero-art">
            <div className="hero-grid" />
            <div className="image-halo" />
            <img src={heroImage} alt="Estudiante aprendiendo en AulaFlow" />
            <div className="floating-card lesson-done">
              <i>
                <Check />
              </i>
              <div>
                <strong>Lección completada</strong>
                <span>Diseño de interfaces</span>
              </div>
            </div>
            <div className="floating-card students-card">
              <div className="mini-chart">
                <b />
                <b />
                <b />
                <b />
              </div>
              <div>
                <strong>{content.metrics.students}</strong>
                <span>estudiantes activos</span>
              </div>
            </div>
            <div className="floating-badge">
              <GraduationCap />
              {content.metrics.enrollments} inscripciones
            </div>
          </div>
        </section>

        <section className="brand-strip">
          <span>Aprende con contenido para</span>
          <div>
            <strong>TECNOLOGÍA</strong>
            <strong>DISEÑO</strong>
            <strong>NEGOCIOS</strong>
            <strong>CREATIVIDAD</strong>
          </div>
        </section>

        <section className="home-section categories-section">
          <div className="home-heading centered">
            <span>Explora por categoría</span>
            <h2>Encuentra el camino ideal para ti</h2>
            <p>
              Elige un área y comienza a desarrollar habilidades que el mercado
              está buscando.
            </p>
          </div>
          <div className="category-grid">
            {categories.map((category) => {
              const look = categoryLooks[category.slug] ?? {
                icon: BookOpen,
                tone: "purple",
              };
              const Icon = look.icon;
              return (
                <Link
                  to={`/courses?category=${category.slug}`}
                  className={`category-card ${look.tone}`}
                  key={category.id}
                >
                  <i>
                    <Icon />
                  </i>
                  <div>
                    <h3>{category.name}</h3>
                    <p>{category.description}</p>
                  </div>
                  <ArrowRight />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="home-section featured-section">
          <div className="home-heading heading-row">
            <div>
              <span>Los favoritos de la comunidad</span>
              <h2>Cursos destacados</h2>
            </div>
            <Link className="text-link" to="/courses">
              Ver todos los cursos <ArrowRight />
            </Link>
          </div>
          {courses.length ? (
            <div className="course-grid">
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          ) : (
            <div className="course-skeletons">
              {[1, 2, 3].map((x) => (
                <div key={x}>
                  <i />
                  <b />
                  <span />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="experience-section">
          <div className="experience-art">
            <div className="experience-window">
              <div className="window-top">
                <i />
                <i />
                <i />
              </div>
              <div className="window-body">
                <aside>
                  <span />
                  <span />
                  <span />
                  <span />
                </aside>
                <div>
                  <div className="video-placeholder">
                    <Play />
                  </div>
                  <b />
                  <p />
                  <p />
                  <div className="mini-progress">
                    <i />
                  </div>
                </div>
              </div>
            </div>
            <div className="achievement">
              <ShieldCheck />
              <span>
                <strong>Nuevo logro</strong>Curso completado
              </span>
            </div>
          </div>
          <div className="experience-copy">
            <span className="section-tag">Una experiencia diferente</span>
            <h2>Todo lo que necesitas para seguir avanzando.</h2>
            <p>
              Una plataforma pensada para que aprender sea claro, flexible y
              motivador desde la primera lección.
            </p>
            <ul>
              <li>
                <i>
                  <Play />
                </i>
                <div>
                  <strong>Aprende a tu ritmo</strong>
                  <span>
                    Accede cuando quieras y continúa exactamente donde quedaste.
                  </span>
                </div>
              </li>
              <li>
                <i>
                  <Layers3 />
                </i>
                <div>
                  <strong>Contenido realmente práctico</strong>
                  <span>
                    Proyectos y ejercicios basados en situaciones profesionales.
                  </span>
                </div>
              </li>
              <li>
                <i>
                  <BarChart3 />
                </i>
                <div>
                  <strong>Mide tu progreso</strong>
                  <span>
                    Visualiza tus avances y celebra cada objetivo alcanzado.
                  </span>
                </div>
              </li>
            </ul>
            <Link className="button home-primary" to="/register">
              Empezar a aprender <ArrowRight />
            </Link>
          </div>
        </section>

        <section className="home-section teachers-section">
          <div className="home-heading centered">
            <span>Aprende de los mejores</span>
            <h2>Profesionales que comparten experiencia real</h2>
          </div>
          <div className="teacher-grid">
            {content.instructors.map((t) => (
              <article className="teacher-card" key={t.name}>
                <div className={`teacher-avatar ${t.tone}`}>
                  {t.initials}
                  <span>
                    <Check />
                  </span>
                </div>
                <h3>{t.name}</h3>
                <p>{t.role}</p>
                <div>
                  <span>
                    <Star />
                    {Number(t.rating).toFixed(1)}
                  </span>
                  <span>
                    <Users />
                    {t.student_count} estudiantes
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {content.testimonials.length > 0 && (
          <section className="testimonial-section" aria-live="polite">
            <div className="testimonial-slide" key={testimonial}>
              <Quote />
              <blockquote>
                “{content.testimonials[testimonial].quote}”
              </blockquote>
              <div className="testimonial-person">
                <i>{content.testimonials[testimonial].initials}</i>
                <div>
                  <strong>{content.testimonials[testimonial].name}</strong>
                  <span>{content.testimonials[testimonial].role}</span>
                </div>
              </div>
            </div>
            <div className="testimonial-dots">
              {content.testimonials.map((item, index) => (
                <button
                  key={item.name}
                  className={index === testimonial ? "active" : ""}
                  onClick={() => setTestimonial(index)}
                  aria-label={`Ver testimonio ${index + 1}`}
                />
              ))}
            </div>
          </section>
        )}

        <section className="home-cta">
          <div className="cta-pattern" />
          <div>
            <span>
              <Sparkles />
              Tu siguiente paso está aquí
            </span>
            <h2>Convierte tu curiosidad en una nueva habilidad.</h2>
            <p>
              Únete a miles de estudiantes que ya están construyendo su futuro
              en AulaFlow.
            </p>
          </div>
          <div>
            <Link className="cta-white" to="/register">
              Crear cuenta gratis <ArrowRight />
            </Link>
            <small>
              <Check />
              Acceso inmediato <Check />
              Sin tarjeta
            </small>
          </div>
        </section>
      </main>
      <section className="trust-band">
        <div>
          <Award />
          <span>
            <strong>Contenido profesional</strong>Creado por especialistas
          </span>
        </div>
        <div>
          <LockKeyhole />
          <span>
            <strong>Aprendizaje seguro</strong>Tu progreso siempre protegido
          </span>
        </div>
        <div>
          <Headphones />
          <span>
            <strong>Soporte cercano</strong>Estamos para ayudarte
          </span>
        </div>
      </section>
      <footer className="home-footer">
        <div className="footer-main">
          <div className="footer-about">
            <Link className="footer-logo" to="/">
              <BookOpen />
              <strong>
                Aula<span>Flow</span>
              </strong>
            </Link>
            <p>
              Impulsamos carreras a través de educación práctica, flexible y
              conectada con el mundo profesional.
            </p>
            <div className="social-links">
              <a href="#instagram" aria-label="Instagram">
                <Instagram />
              </a>
              <a href="#linkedin" aria-label="LinkedIn">
                <Linkedin />
              </a>
              <a href="#youtube" aria-label="YouTube">
                <Youtube />
              </a>
            </div>
          </div>
          <div className="footer-column">
            <strong>Aprende</strong>
            <Link to="/courses">Todos los cursos</Link>
            <Link to="/courses?category=desarrollo">Desarrollo</Link>
            <Link to="/courses?category=diseno">Diseño UX/UI</Link>
            <Link to="/courses?category=negocios">Negocios</Link>
          </div>
          <div className="footer-column">
            <strong>AulaFlow</strong>
            <a href="#profesores">Profesores</a>
            <a href="#testimonios">Historias de éxito</a>
            <Link to="/register">Crear una cuenta</Link>
            <a href="mailto:soporte@aulaflow.test">Centro de ayuda</a>
          </div>
          <div className="footer-newsletter">
            <span>Consejos para seguir creciendo</span>
            <h3>Aprende algo nuevo cada semana.</h3>
            <p>
              Recibe recursos, cursos y oportunidades seleccionadas para ti.
            </p>
            <form onSubmit={(e) => e.preventDefault()}>
              <label>
                <Mail />
                <input
                  type="email"
                  aria-label="Correo para novedades"
                  placeholder="tu@email.com"
                  required
                />
              </label>
              <button type="submit" aria-label="Suscribirse">
                <ArrowRight />
              </button>
            </form>
            <small>Sin spam. Cancela cuando quieras.</small>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 AulaFlow. Todos los derechos reservados.</span>
          <div>
            <a href="#privacidad">Privacidad</a>
            <a href="#terminos">Términos</a>
            <a href="#cookies">Cookies</a>
          </div>
          <p>
            <i />
            Plataforma operativa
          </p>
        </div>
      </footer>
    </div>
  );
}
