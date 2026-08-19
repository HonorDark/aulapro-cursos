import { useCallback, useEffect, useState } from "react";
import { api } from "../../../shared/api/client";
import type { NotificationResponse } from "../types";

export function useNotifications() {
  const [data, setData] = useState<NotificationResponse>({
    items: [],
    unread: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await api<NotificationResponse>("/notifications");
      setData(response.data);
      setError("");
    } catch (loadError) {
      setError((loadError as Error).message);
    }
  }, []);
  useEffect(() => {
    void load().finally(() => setLoading(false));
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);
  const read = async (id: string) => {
    const previous = data;
    setData((current) => ({
      unread: Math.max(
        0,
        current.unread -
          (current.items.find((item) => item.id === id)?.is_read ? 0 : 1),
      ),
      items: current.items.map((item) =>
        item.id === id ? { ...item, is_read: true } : item,
      ),
    }));
    try {
      await api(`/notifications/${id}/read`, { method: "PATCH" });
    } catch (readError) {
      setData(previous);
      setError((readError as Error).message);
    }
  };
  const readAll = async () => {
    const previous = data;
    setData((current) => ({
      unread: 0,
      items: current.items.map((item) => ({ ...item, is_read: true })),
    }));
    try {
      await api("/notifications/read-all", { method: "PATCH" });
    } catch (readError) {
      setData(previous);
      setError((readError as Error).message);
    }
  };
  return { ...data, loading, error, read, readAll, reload: load };
}
