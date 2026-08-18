import { ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { COURSE_LEVEL_LABELS } from "../../../shared/constants/labels";
import type { Course } from "../../../types";

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80";

export function CourseCard({ course }: { course: Course }) {
  return (
    <article className="course-card">
      <img
        src={course.image_url ?? FALLBACK_COVER}
        alt={`Portada de ${course.title}`}
      />
      <div className="course-body">
        <span className="eyebrow">{course.category_name ?? "Formación"}</span>
        <h3>{course.title}</h3>
        <p>Por {course.instructor}</p>
        <div className="course-meta">
          <span>
            <Clock size={15} />
            {Math.round(course.duration_minutes / 60)} h
          </span>
          <span>{COURSE_LEVEL_LABELS[course.level] ?? course.level}</span>
        </div>
        <div className="course-foot">
          <strong>
            {Number(course.price) === 0 ? "Gratis" : `$${course.price}`}
          </strong>
          <Link to={`/courses/${course.slug}`}>
            Ver curso <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
