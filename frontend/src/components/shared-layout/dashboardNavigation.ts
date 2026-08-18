import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
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
      label: "Calendario y evaluaciones",
      icon: ClipboardCheck,
    },
    { to: "/admin/students", label: "Estudiantes", icon: Users },
    { to: "/admin/payments", label: "Pagos", icon: CreditCard },
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
      label: "Calendario y evaluaciones",
      icon: ClipboardCheck,
    },
    { to: "/admin/students", label: "Estudiantes", icon: Users },
    { to: "/admin/payments", label: "Pagos", icon: CreditCard },
    {
      to: "/super-admin/payment-decisions",
      label: "Corregir pagos",
      icon: ShieldCheck,
    },
    { to: "/profile", label: "Mi perfil", icon: UserRound },
  ],
};

export const roleNames: Record<Role, string> = {
  STUDENT: "Estudiante",
  ADMIN: "Administrador",
  SUPER_ADMIN: "Superadministrador",
};
