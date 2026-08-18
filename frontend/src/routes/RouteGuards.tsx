import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";

interface RouteGuardProps {
  roles?: readonly Role[];
}

function RouteGuard({ roles }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-state">Cargando tu sesión…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to="/403" replace />;

  return <Outlet />;
}

export const ProtectedRoute = () => <RouteGuard />;
export const StudentRoute = () => <RouteGuard roles={["STUDENT"]} />;
export const AdminRoute = () => <RouteGuard roles={["ADMIN", "SUPER_ADMIN"]} />;
export const SuperAdminRoute = () => <RouteGuard roles={["SUPER_ADMIN"]} />;
