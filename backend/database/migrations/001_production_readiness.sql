SET client_encoding = 'UTF8';

-- Migración idempotente para instalaciones existentes de AulaFlow.
-- Conserva inscripciones y progreso; revocar acceso nunca elimina la fila.

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS categories_active_idx ON categories(is_active,name);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_token_version_nonnegative'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_token_version_nonnegative CHECK (token_version >= 0);
  END IF;
END $$;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS access_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS access_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS access_reason TEXT;

UPDATE enrollments
SET access_status = 'ACTIVE'
WHERE access_status IS NULL
   OR access_status NOT IN ('ACTIVE','SUSPENDED','REVOKED');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enrollments_access_status_check'
      AND conrelid = 'enrollments'::regclass
  ) THEN
    ALTER TABLE enrollments
      ADD CONSTRAINT enrollments_access_status_check
      CHECK (access_status IN ('ACTIVE','SUSPENDED','REVOKED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS enrollments_access_idx
  ON enrollments(user_id,access_status,course_id);

-- Si una instalación antigua permitió varios pagos pendientes para el mismo
-- curso, conserva el más reciente y cierra los anteriores antes de crear el índice.
WITH duplicate_pending AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id,course_id
           ORDER BY created_at DESC,id DESC
         ) AS duplicate_number
  FROM payments
  WHERE status = 'PENDING'
)
UPDATE payments p
SET status = 'REJECTED',
    review_notes = concat_ws(
      E'\n',
      NULLIF(p.review_notes,''),
      'Cerrado automáticamente al consolidar solicitudes de pago duplicadas.'
    ),
    reviewed_at = COALESCE(p.reviewed_at,NOW()),
    updated_at = NOW()
FROM duplicate_pending d
WHERE p.id = d.id
  AND d.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS payments_one_pending_per_course_idx
  ON payments(user_id,course_id)
  WHERE status = 'PENDING';

-- Repara exclusivamente datos reconocibles del seed que pudieron importarse
-- con una codificación de cliente incorrecta. No modifica contenido de usuarios.
CREATE OR REPLACE FUNCTION repair_seed_mojibake(value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
BEGIN
  IF value !~ '[ÃÂ]' THEN
    RETURN value;
  END IF;
  BEGIN
    RETURN convert_from(convert_to(value,'LATIN1'),'UTF8');
  EXCEPTION WHEN OTHERS THEN
    RETURN value;
  END;
END $$;

UPDATE users SET name='Sofía Estudiante' WHERE LOWER(email)='student@aulapro.test';
UPDATE users SET name='Lucía Compradora' WHERE LOWER(email)='lucia@aulaflow.test';

UPDATE categories SET name='Diseño',description='Diseño digital y experiencia de usuario' WHERE slug='diseno';
UPDATE categories SET description='Programación y tecnología' WHERE slug='desarrollo';
UPDATE categories SET description='Gestión, estrategia y emprendimiento' WHERE slug='negocios';
UPDATE categories SET description='Crecimiento y comunicación digital' WHERE slug='marketing';

UPDATE courses SET
  title='React y TypeScript profesional',
  description='Construye aplicaciones modernas, accesibles y mantenibles desde cero.',
  instructor='Laura Méndez'
WHERE slug='react-typescript';
UPDATE courses SET
  title='Node.js y APIs REST',
  description='Diseña servicios seguros, escalables y bien estructurados con Express.'
WHERE slug='node-apis';
UPDATE courses SET
  title='Diseño UX/UI desde cero',
  description='Investiga, prototipa y valida experiencias que las personas disfrutan.'
WHERE slug='ux-ui';
UPDATE courses SET
  title='Liderazgo para equipos ágiles',
  description='Herramientas prácticas para liderar equipos de alto rendimiento.'
WHERE slug='liderazgo-agil';
UPDATE courses SET
  description='Convierte métricas en decisiones y campañas con impacto medible.'
WHERE slug='marketing-datos';

UPDATE payment_settings
SET account_holder='AulaFlow Educación',
    instructions='Incluye el nombre del estudiante y el curso en la referencia de la transferencia.'
WHERE id=1;

UPDATE modules SET title=repair_seed_mojibake(title)
WHERE course_id IN (SELECT id FROM courses WHERE slug IN ('react-typescript','node-apis','ux-ui','liderazgo-agil','marketing-datos','postgresql'));
UPDATE lessons SET title=repair_seed_mojibake(title),content=repair_seed_mojibake(content)
WHERE module_id IN (
  SELECT m.id FROM modules m JOIN courses c ON c.id=m.course_id
  WHERE c.slug IN ('react-typescript','node-apis','ux-ui','liderazgo-agil','marketing-datos','postgresql')
);
UPDATE course_resources r
SET title=repair_seed_mojibake(r.title),description=repair_seed_mojibake(r.description)
FROM courses c
WHERE c.id=r.course_id
  AND c.slug IN ('react-typescript','ux-ui','marketing-datos','liderazgo-agil');
UPDATE evaluations e
SET title=repair_seed_mojibake(e.title),description=repair_seed_mojibake(e.description)
FROM courses c WHERE c.id=e.course_id
  AND c.slug IN ('react-typescript','ux-ui','marketing-datos','liderazgo-agil');
UPDATE assignments a
SET title=repair_seed_mojibake(a.title),description=repair_seed_mojibake(a.description)
FROM courses c WHERE c.id=a.course_id
  AND c.slug IN ('react-typescript','ux-ui','marketing-datos','liderazgo-agil');
UPDATE assignment_submissions s
SET answer_text=repair_seed_mojibake(s.answer_text),feedback=repair_seed_mojibake(s.feedback)
FROM users u WHERE u.id=s.user_id AND LOWER(u.email)='student@aulapro.test';
UPDATE surveys s
SET title=repair_seed_mojibake(s.title),description=repair_seed_mojibake(s.description)
FROM courses c WHERE c.id=s.course_id AND c.slug IN ('react-typescript','ux-ui');
UPDATE survey_questions q SET prompt=repair_seed_mojibake(q.prompt)
FROM surveys s JOIN courses c ON c.id=s.course_id
WHERE s.id=q.survey_id AND c.slug IN ('react-typescript','ux-ui');
UPDATE survey_responses r SET answers=repair_seed_mojibake(r.answers::TEXT)::JSONB
FROM users u WHERE u.id=r.user_id AND LOWER(u.email)='student@aulapro.test';
UPDATE course_reviews r SET comment=repair_seed_mojibake(r.comment)
FROM users u WHERE u.id=r.user_id AND LOWER(u.email)='student@aulapro.test';
UPDATE featured_instructors
SET name=repair_seed_mojibake(name),role=repair_seed_mojibake(role)
WHERE initials IN ('LM','CV','AT');
UPDATE testimonials
SET quote=repair_seed_mojibake(quote),name=repair_seed_mojibake(name),role=repair_seed_mojibake(role)
WHERE initials IN ('SR','DM','CT');
UPDATE payments SET payer_name=repair_seed_mojibake(payer_name),review_notes=repair_seed_mojibake(review_notes)
WHERE reference LIKE 'DEMO-%' OR reference='TRX-948271';

DROP FUNCTION repair_seed_mojibake(TEXT);
