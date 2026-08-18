export type StudentSummary = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  enrollments: number;
};

export type StudentCourse = {
  id: string;
  course_id: string;
  title: string;
  image_url: string | null;
  enrolled_at: string;
  completed_at: string | null;
  lesson_count: number;
  completed_count: number;
  progress: number;
};

export type StudentDetail = StudentSummary & {
  avatar_url: string | null;
  payments: number;
  courses: StudentCourse[];
};

export type StudentDialogMode = "view" | "edit" | "delete";

export type StudentUpdate = {
  name: string;
  email: string;
  isActive: boolean;
};
