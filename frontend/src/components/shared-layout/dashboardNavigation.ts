import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Inbox,
  Settings2,
  ListChecks,
  CreditCard,
  LayoutDashboard,
  Landmark,
  Library,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "../../types";

export interface DashboardNavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const dashboardNavigation: Record<
  Role,
  readonly DashboardNavigationItem[]
> = {
  STUDENT: [
    { to: "/student", label: "Mi aprendizaje", icon: LayoutDashboard },
    { to: "/student/courses", label: "Explorar cursos", icon: Library },
    { to: "/student/calendar", label: "Mi calendario", icon: CalendarDays },
    { to: "/student/tasks", label: "Tareas y evaluaciones", icon: ListChecks },
    { to: "/profile", label: "Mi perfil", icon: UserRound },
  ],
  ADMIN: [
    { to: "/admin", label: "Panel académico", icon: LayoutDashboard },
    { to: "/admin/courses", label: "Gestión de cursos", icon: BookOpen },
    {
      to: "/admin/course-editor",
      label: "Editor de contenidos",
      icon: Library,
    },
    {
      to: "/admin/academic",
      label: "Calendario y actividades",
      icon: ClipboardCheck,
    },
    { to: "/admin/submissions", label: "Revisar entregas", icon: Inbox },
    { to: "/admin/students", label: "Estudiantes", icon: Users },
    { to: "/admin/enrollments", label: "Inscripciones", icon: ListChecks },
    { to: "/admin/payments", label: "Pagos", icon: CreditCard },
    { to: "/admin/accounting", label: "Contabilidad", icon: Landmark },
    { to: "/profile", label: "Mi perfil", icon: UserRound },
  ],
  SUPER_ADMIN: [
    { to: "/super-admin", label: "Vista general", icon: LayoutDashboard },
    { to: "/super-admin/users", label: "Usuarios y roles", icon: ShieldCheck },
    { to: "/admin/courses", label: "Todos los cursos", icon: BookOpen },
    {
      to: "/admin/course-editor",
      label: "Editor de contenidos",
      icon: Library,
    },
    {
      to: "/admin/academic",
      label: "Calendario y actividades",
      icon: ClipboardCheck,
    },
    { to: "/admin/submissions", label: "Revisar entregas", icon: Inbox },
    { to: "/admin/students", label: "Estudiantes", icon: Users },
    { to: "/admin/payments", label: "Pagos", icon: CreditCard },
    { to: "/admin/accounting", label: "Contabilidad", icon: Landmark },
    {
      to: "/super-admin/payment-decisions",
      label: "Corregir pagos",
      icon: ShieldCheck,
    },
    {
      to: "/super-admin/settings",
      label: "Configuración del sistema",
      icon: Settings2,
    },
    { to: "/profile", label: "Mi perfil", icon: UserRound },
  ],
};

export const roleNames: Record<Role, string> = {
  STUDENT: "Estudiante",
  ADMIN: "Administrador",
  SUPER_ADMIN: "Superadministrador",
};
