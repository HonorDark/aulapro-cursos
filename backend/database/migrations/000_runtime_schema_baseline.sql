SET client_encoding = 'UTF8';

-- Consolida en migraciones el DDL que versiones anteriores creaban al atender
-- la primera petición. Debe ejecutarse antes de 001 en instalaciones antiguas.

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS document_number VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(220);
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(500);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS modality VARCHAR(30) NOT NULL DEFAULT 'ONLINE';

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'INFO'
    CHECK(type IN ('INFO','SUCCESS','WARNING','ERROR')),
  href TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications(user_id,is_read) WHERE is_read=false;

CREATE TABLE IF NOT EXISTS course_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  resource_type VARCHAR(20) NOT NULL DEFAULT 'LINK'
    CHECK(resource_type IN ('LINK','PDF','VIDEO','FILE')),
  url TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS course_resources_course_idx
  ON course_resources(course_id,is_published);

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  max_score NUMERIC(6,2) NOT NULL DEFAULT 100 CHECK(max_score>0),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS assignments_course_idx ON assignments(course_id);
CREATE INDEX IF NOT EXISTS assignments_due_idx ON assignments(due_at);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_text TEXT,
  attachment_data TEXT,
  attachment_name VARCHAR(255),
  attachment_mime VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED'
    CHECK(status IN ('SUBMITTED','CHANGES_REQUESTED','GRADED')),
  score NUMERIC(6,2),
  feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(assignment_id,user_id)
);
CREATE INDEX IF NOT EXISTS assignment_submissions_status_idx
  ON assignment_submissions(status,submitted_at DESC);

ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE evaluation_submissions
  DROP CONSTRAINT IF EXISTS evaluation_submissions_status_check;
ALTER TABLE evaluation_submissions ADD COLUMN IF NOT EXISTS answer_text TEXT;
ALTER TABLE evaluation_submissions ADD COLUMN IF NOT EXISTS attachment_data TEXT;
ALTER TABLE evaluation_submissions ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);
ALTER TABLE evaluation_submissions ADD COLUMN IF NOT EXISTS attachment_mime VARCHAR(100);
ALTER TABLE evaluation_submissions ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE evaluation_submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE evaluation_submissions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE evaluation_submissions ALTER COLUMN score TYPE NUMERIC(6,2);
ALTER TABLE evaluation_submissions
  ADD CONSTRAINT evaluation_submissions_status_check
  CHECK(status IN ('PENDING','SUBMITTED','CHANGES_REQUESTED','GRADED'));
CREATE INDEX IF NOT EXISTS evaluation_submissions_status_idx
  ON evaluation_submissions(status,submitted_at DESC);

CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  closes_at TIMESTAMPTZ NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS survey_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position>0),
  UNIQUE(survey_id,position)
);
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(survey_id,user_id)
);
CREATE INDEX IF NOT EXISTS surveys_course_idx ON surveys(course_id,closes_at);

ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED';
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE survey_responses DROP CONSTRAINT IF EXISTS survey_responses_status_check;
ALTER TABLE survey_responses
  ADD CONSTRAINT survey_responses_status_check
  CHECK(status IN ('SUBMITTED','CHANGES_REQUESTED','VERIFIED'));
CREATE INDEX IF NOT EXISTS survey_responses_status_idx
  ON survey_responses(status,submitted_at DESC);

