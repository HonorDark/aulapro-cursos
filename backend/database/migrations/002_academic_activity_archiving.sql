\encoding UTF8
SET client_encoding = 'UTF8';

-- Archivado lógico de actividades académicas.
-- Las filas y sus entregas/respuestas se conservan para auditoría e historial.
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE surveys
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS assignments_active_course_idx
  ON assignments(course_id,due_at) WHERE is_archived=FALSE;
CREATE INDEX IF NOT EXISTS evaluations_active_course_idx
  ON evaluations(course_id,due_at) WHERE is_archived=FALSE;
CREATE INDEX IF NOT EXISTS surveys_active_course_idx
  ON surveys(course_id,closes_at) WHERE is_archived=FALSE;
