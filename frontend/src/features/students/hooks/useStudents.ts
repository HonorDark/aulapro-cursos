import { useCallback, useEffect, useState } from "react";
import { api } from "../../../shared/api/client";
import { useFeedback } from "../../notifications/feedback-context";
import type {
  StudentDetail,
  StudentDialogMode,
  StudentSummary,
  StudentUpdate,
} from "../types";

export function useStudents() {
  const feedback = useFeedback();
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
      feedback.error("No se pudo abrir el expediente", (error as Error).message);
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
      feedback.success(
        "Estudiante actualizado",
        `Los datos de ${values.name} fueron guardados.`,
      );
      close();
      await load();
    } catch (error) {
      setMessage((error as Error).message);
      feedback.error("No se pudo actualizar", (error as Error).message);
    }
  };

  const remove = async () => {
    if (!selected) return;
    try {
      await api(`/admin/students/${selected.id}`, { method: "DELETE" });
      setMessage(
        `La cuenta de ${selected.name} fue desactivada. Sus datos se conservaron.`,
      );
      feedback.warning(
        "Cuenta desactivada",
        `Los datos y el progreso de ${selected.name} se conservaron.`,
      );
      close();
      await load();
    } catch (error) {
      setMessage((error as Error).message);
      feedback.error("No se pudo desactivar la cuenta", (error as Error).message);
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
