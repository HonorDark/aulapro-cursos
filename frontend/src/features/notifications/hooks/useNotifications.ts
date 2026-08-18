import { useCallback, useEffect, useState } from "react";
import { api } from "../../../shared/api/client";
import type { NotificationResponse } from "../types";

export function useNotifications() {
  const [data, setData] = useState<NotificationResponse>({
    items: [],
    unread: 0,
  });
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const response = await api<NotificationResponse>("/notifications");
    setData(response.data);
  }, []);
  useEffect(() => {
    void load().finally(() => setLoading(false));
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);
  const read = async (id: string) => {
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
    await api(`/notifications/${id}/read`, { method: "PATCH" });
  };
  const readAll = async () => {
    setData((current) => ({
      unread: 0,
      items: current.items.map((item) => ({ ...item, is_read: true })),
    }));
    await api("/notifications/read-all", { method: "PATCH" });
  };
  return { ...data, loading, read, readAll, reload: load };
}
