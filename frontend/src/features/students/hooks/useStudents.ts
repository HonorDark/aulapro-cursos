import { useCallback, useEffect, useState } from "react";
import { api } from "../../../shared/api/client";
import type {
  StudentDetail,
  StudentDialogMode,
  StudentSummary,
  StudentUpdate,
} from "../types";

export function useStudents() {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [selected, setSelected] = useState<StudentDetail | null>(null);
  const [mode, setMode] = useState<StudentDialogMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await api<StudentSummary[]>("/admin/students");
    setStudents(response.data);
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [load]);

  const open = async (student: StudentSummary, nextMode: StudentDialogMode) => {
    setMode(nextMode);
    setDialogLoading(true);
    setSelected(null);
    try {
      const response = await api<StudentDetail>(
        `/admin/students/${student.id}`,
      );
      setSelected(response.data);
    } catch (error) {
      setMessage((error as Error).message);
      setMode(null);
    } finally {
      setDialogLoading(false);
    }
  };

  const close = () => {
    setMode(null);
    setSelected(null);
  };

  const update = async (values: StudentUpdate) => {
    if (!selected) return;
    try {
      await api(`/admin/students/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      setMessage(`Los datos de ${values.name} fueron actualizados.`);
      close();
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const remove = async () => {
    if (!selected) return;
    try {
      await api(`/admin/students/${selected.id}`, { method: "DELETE" });
      setMessage(
        `La cuenta de ${selected.name} fue desactivada. Sus datos se conservaron.`,
      );
      close();
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  return {
    students,
    selected,
    mode,
    loading,
    dialogLoading,
    message,
    open,
    close,
    update,
    remove,
  };
}
