import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { dashboardFor } from "../../routes/dashboard";
import { Brand } from "./Brand";

export function PublicHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="header">
      <Link className="brand" to="/">
        <Brand />
      </Link>
      <nav>
        <Link to="/courses">Explorar cursos</Link>
        {user ? (
          <>
            <Link to={dashboardFor(user.role)}>Mi panel</Link>
            <button className="link-button" onClick={handleLogout}>
              Salir
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Ingresar</Link>
            <Link className="button small" to="/register">
              Crear cuenta
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
