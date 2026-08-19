export type StudentSummary = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  document_number: string | null;
  country: string | null;
  city: string | null;
  is_active: boolean;
  created_at: string;
  enrollments: number;
  profile_fields: number;
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
  address: string | null;
  birth_date: string | null;
  bio: string | null;
  payments: number;
  courses: StudentCourse[];
};

export type StudentDialogMode = "view" | "edit" | "delete";

export type StudentUpdate = {
  name: string;
  email: string;
  isActive: boolean;
  avatarUrl: string | null;
  phone: string | null;
  documentNumber: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  birthDate: string | null;
  bio: string | null;
};
