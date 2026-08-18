import { BookOpen } from "lucide-react";

export function Brand() {
  return (
    <>
      <span className="brand-icon">
        <BookOpen />
      </span>
      <strong className="brand-word">
        Aula<em>Flow</em>
      </strong>
    </>
  );
}
