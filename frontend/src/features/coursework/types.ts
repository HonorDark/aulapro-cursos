export type CourseworkKind = "ASSIGNMENT" | "EVALUATION" | "QUESTIONNAIRE";
export type CourseworkStatus =
  | "NOT_SUBMITTED"
  | "SUBMITTED"
  | "CHANGES_REQUESTED"
  | "GRADED"
  | "VERIFIED";

export type CourseworkItem = {
  id: string;
  kind: CourseworkKind;
  type: string;
  title: string;
  description: string | null;
  due_at: string;
  max_score: string | number | null;
  course_id: string;
  course_title: string;
  status: CourseworkStatus;
  submission_id: string | null;
  score: string | number | null;
  feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  is_overdue: boolean;
};

export type CourseworkQuestion = {
  id: string;
  prompt: string;
  position: number;
};

export type CourseworkDetail = CourseworkItem & {
  answer_text?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_data?: string | null;
  answers?: Record<string, string> | null;
  questions?: CourseworkQuestion[];
  student_name?: string;
  student_email?: string;
  activity_title?: string;
};

export type SubmissionRow = {
  id: string;
  kind: CourseworkKind;
  status: Exclude<CourseworkStatus, "NOT_SUBMITTED">;
  score: string | number | null;
  submitted_at: string;
  reviewed_at: string | null;
  activity_title: string;
  max_score: string | number | null;
  course_id: string;
  course_title: string;
  student_id: string;
  student_name: string;
  student_email: string;
  has_attachment: boolean;
  has_answer: boolean;
};

export const courseworkKindLabels: Record<CourseworkKind, string> = {
  ASSIGNMENT: "Tarea",
  EVALUATION: "Evaluación",
  QUESTIONNAIRE: "Cuestionario",
};

export const courseworkStatusLabels: Record<CourseworkStatus, string> = {
  NOT_SUBMITTED: "Por entregar",
  SUBMITTED: "En revisión",
  CHANGES_REQUESTED: "Requiere cambios",
  GRADED: "Calificada",
  VERIFIED: "Verificado",
};

export function courseworkPathKind(kind: CourseworkKind) {
  return kind.toLowerCase() as Lowercase<CourseworkKind>;
}
