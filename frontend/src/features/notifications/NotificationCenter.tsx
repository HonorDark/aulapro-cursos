import {
  Bell,
  Check,
  CheckCheck,
  Info,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "./hooks/useNotifications";
import type { NotificationItem } from "./types";

function relativeDate(value: string) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (minutes < 1_440) return `Hace ${Math.floor(minutes / 60)} h`;
  return new Date(value).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
  });
}
function NotificationIcon({ item }: { item: NotificationItem }) {
  if (item.type === "SUCCESS") return <Check />;
  if (item.type === "WARNING") return <TriangleAlert />;
  if (item.type === "ERROR") return <XCircle />;
  return <Info />;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const center = useNotifications();
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const select = async (item: NotificationItem) => {
    if (!item.is_read) await center.read(item.id);
    setOpen(false);
    if (item.href) navigate(item.href);
  };
  return (
    <div className="notification-center" ref={root}>
      <button
        className="notification"
        aria-label={`Notificaciones${center.unread ? `, ${center.unread} sin leer` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell />
        {center.unread > 0 && <i>{center.unread > 9 ? "9+" : center.unread}</i>}
      </button>
      {open && (
        <section className="notification-popover">
          <header>
            <div>
              <span>ACTUALIZACIONES</span>
              <h2>Notificaciones</h2>
            </div>
            {center.unread > 0 && (
              <button onClick={() => void center.readAll()}>
                <CheckCheck />
                Marcar leídas
              </button>
            )}
          </header>
          <div className="notification-list">
            {center.loading ? (
              <p className="notification-empty">Cargando notificaciones…</p>
            ) : center.items.length ? (
              center.items.map((item) => (
                <button
                  key={item.id}
                  className={`${item.type.toLowerCase()} ${item.is_read ? "read" : "unread"}`}
                  onClick={() => void select(item)}
                >
                  <i>
                    <NotificationIcon item={item} />
                  </i>
                  <span>
                    <strong>{item.title}</strong>
                    <p>{item.message}</p>
                    <small>{relativeDate(item.created_at)}</small>
                  </span>
                  {!item.is_read && <b />}
                </button>
              ))
            ) : (
              <p className="notification-empty">
                <Bell />
                No tienes notificaciones.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
