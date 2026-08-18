export type Role = "STUDENT" | "ADMIN" | "SUPER_ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  instructor: string;
  image_url: string | null;
  level: string;
  price: string | number;
  duration_minutes: number;
  category_id?: string;
  category_name?: string;
  is_published: boolean;
  enrollment_count?: number;
  rating?: string | number;
  review_count?: number;
  module_count?: number;
  modules?: Module[];
}

export interface Module {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  video_url: string | null;
  duration_minutes: number;
  position: number;
  is_preview?: boolean;
  completed?: boolean;
}
