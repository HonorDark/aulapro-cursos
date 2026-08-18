import { ChevronRight, LifeBuoy, LogOut, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Brand } from "./Brand";
import { dashboardNavigation, roleNames } from "./dashboardNavigation";
import { TableSearch } from "./TableSearch";
import { NotificationCenter } from "../../features/notifications/NotificationCenter";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      setOpen(true);
      return;
    }

    setCollapsed((value) => !value);
  };

  return (
    <div className={`shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="sidebar-head">
          <Link className="brand light" to="/">
            <Brand />
          </Link>
          <button
            className="icon-btn mobile"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          >
            <X />
          </button>
        </div>

        <span className="nav-caption">NAVEGACIÓN</span>
        <nav>
          {dashboardNavigation[user.role].map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={() => setOpen(false)}
              title={collapsed ? label : undefined}
            >
              <Icon />
              <span>{label}</span>
              <ChevronRight className="nav-chevron" />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <a className="sidebar-help" href="mailto:soporte@aulaflow.test">
          <LifeBuoy />
          <span>
            <strong>Centro de ayuda</strong>
            <small>Soporte y preguntas</small>
          </span>
          <ChevronRight />
        </a>
        <button className="logout" onClick={logout}>
          <LogOut />
          <span>Cerrar sesión</span>
        </button>
        <div className="user-card">
          <div className="avatar">{user.name[0]}</div>
          <div>
            <strong>{user.name}</strong>
            <small>{roleNames[user.role]}</small>
          </div>
          <Link to="/profile" aria-label="Abrir perfil">
            <ChevronRight />
          </Link>
        </div>
      </aside>

      <main className="dashboard">
        <header className="dash-topbar">
          <button
            className="top-menu-button"
            onClick={toggleSidebar}
            aria-label="Alternar menú lateral"
            aria-expanded={!collapsed}
          >
            <Menu />
          </button>
          <TableSearch />
          <div className="topbar-actions">
            <NotificationCenter />
            <div className="top-user">
              <div>
                <strong>{user.name.split(" ")[0]}</strong>
                <small>{roleNames[user.role]}</small>
              </div>
              <span className="top-avatar">{user.name[0]}</span>
            </div>
          </div>
        </header>
        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  );
}
