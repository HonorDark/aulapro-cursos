import { BookOpen, Clock, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PublicHeader } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import type { Course } from "../types";

export { CourseCard } from "../features/courses/components/CourseCard";

export function CourseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<Course>(`/courses/${id}`)
      .then((response) => setCourse(response.data))
      .catch((error: Error) => setMessage(error.message));
  }, [id]);

  const enroll = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (user.role !== "STUDENT") {
      setMessage("Solo las cuentas de estudiante pueden inscribirse.");
      return;
    }
    if (Number(course?.price) > 0) {
      navigate(`/student/checkout/${course?.id}`);
      return;
    }
    try {
      await api("/enrollments", {
        method: "POST",
        body: JSON.stringify({ courseId: course?.id }),
      });
      setMessage("¡Inscripción completada! Ya puedes entrar al aula.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  if (!course) {
    return (
      <>
        <PublicHeader />
        <div className="page-state">{message || "Cargando curso…"}</div>
      </>
    );
  }

  return (
    <>
      <PublicHeader />
      <main className="container">
        <section className="detail-hero">
          <div>
            <span className="eyebrow">{course.category_name}</span>
            <h1>{course.title}</h1>
            <p>{course.description}</p>
            <div className="detail-facts">
              <span>
                <Users /> {course.instructor}
              </span>
              <span>
                <Clock /> {Math.round(course.duration_minutes / 60)} horas
              </span>
            </div>
            <button className="button" onClick={() => void enroll()}>
              {Number(course.price) === 0
                ? "Inscribirme gratis"
                : `Comprar curso · $${course.price}`}
            </button>
            {message && <div className="alert">{message}</div>}
          </div>
          <img
            src={course.image_url ?? ""}
            alt={`Portada de ${course.title}`}
          />
        </section>
        <section className="curriculum">
          <h2>Contenido del curso</h2>
          {course.modules?.map((module, index) => (
            <details key={module.id} open={index === 0}>
              <summary>
                <strong>
                  {index + 1}. {module.title}
                </strong>
                <span>{module.lessons.length} lecciones</span>
              </summary>
              {module.lessons.map((lesson) => (
                <div className="lesson-row" key={lesson.id}>
                  <BookOpen size={17} />
                  {lesson.title}
                  <span>{lesson.duration_minutes} min</span>
                </div>
              ))}
            </details>
          ))}
        </section>
      </main>
    </>
  );
}
