import type { Role } from "../types";

const dashboardsByRole: Record<Role, string> = {
  STUDENT: "/student",
  ADMIN: "/admin",
  SUPER_ADMIN: "/super-admin",
};

export const dashboardFor = (role: Role) => dashboardsByRole[role];
