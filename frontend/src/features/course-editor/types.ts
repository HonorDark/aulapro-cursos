import type { Lesson, Module } from "../../types";

export type CourseCategory = {
  id: string;
  name: string;
};

export type CourseFormValues = {
  title: string;
  slug: string;
  description: string;
  instructor: string;
  categoryId: string | null;
  imageUrl: string | null;
  level: string;
  price: number;
  durationMinutes: number;
  isPublished: boolean;
};

export type LessonFormValues = {
  title: string;
  content: string;
  videoUrl: string | null;
  durationMinutes: number;
  position: number;
  isPreview: boolean;
};

export type ModuleFormValues = {
  title: string;
  position: number;
};

export type ModuleEditorProps = {
  module: Module;
  onSave: (module: Module, title: string, position: number) => Promise<void>;
  onRemove: (module: Module) => Promise<void>;
  onAddLesson: (module: Module) => void;
  onSaveLesson: (
    module: Module,
    lesson: Lesson,
    values: LessonFormValues,
  ) => Promise<void>;
  onRemoveLesson: (lesson: Lesson) => Promise<void>;
};

export type CourseResourceType = "LINK" | "PDF" | "VIDEO" | "FILE";

export type CourseResource = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  resource_type: CourseResourceType;
  url: string;
  is_published: boolean;
  created_at: string;
};

export type CourseResourceFormValues = {
  title: string;
  description: string | null;
  resourceType: CourseResourceType;
  url: string;
  isPublished: boolean;
};
