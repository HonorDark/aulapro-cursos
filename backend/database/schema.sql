SET client_encoding = 'UTF8';

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('STUDENT','ADMIN','SUPER_ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE course_level AS ENUM ('BEGINNER','INTERMEDIATE','ADVANCED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(120) NOT NULL, email VARCHAR(255) NOT NULL,
 password_hash VARCHAR(255) NOT NULL, role user_role NOT NULL DEFAULT 'STUDENT', avatar_url TEXT,
 token_version INTEGER NOT NULL DEFAULT 0 CONSTRAINT users_token_version_nonnegative CHECK(token_version >= 0),
 is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS document_number VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(220);
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_token_version_nonnegative' AND conrelid='users'::regclass) THEN
  ALTER TABLE users ADD CONSTRAINT users_token_version_nonnegative CHECK(token_version>=0);
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash VARCHAR(64) NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reset_user_idx ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS categories (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(100) NOT NULL UNIQUE, slug VARCHAR(120) NOT NULL UNIQUE,
 description TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS categories_active_idx ON categories(is_active,name);
CREATE TABLE IF NOT EXISTS courses (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
 title VARCHAR(180) NOT NULL, slug VARCHAR(200) NOT NULL UNIQUE, description TEXT NOT NULL, instructor VARCHAR(120) NOT NULL,
 image_url TEXT, level course_level NOT NULL DEFAULT 'BEGINNER', price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK(price>=0),
 duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK(duration_minutes>=0), is_published BOOLEAN NOT NULL DEFAULT FALSE,
 created_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS modality VARCHAR(30) NOT NULL DEFAULT 'ONLINE';
CREATE INDEX IF NOT EXISTS courses_category_idx ON courses(category_id); CREATE INDEX IF NOT EXISTS courses_published_idx ON courses(is_published);
CREATE TABLE IF NOT EXISTS modules (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 title VARCHAR(180) NOT NULL, position INTEGER NOT NULL CHECK(position>0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(course_id,position)
);
CREATE TABLE IF NOT EXISTS lessons (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
 title VARCHAR(180) NOT NULL, content TEXT NOT NULL DEFAULT '', video_url TEXT, duration_minutes INTEGER NOT NULL DEFAULT 0,
 position INTEGER NOT NULL CHECK(position>0), is_preview BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(module_id,position)
);
CREATE TABLE IF NOT EXISTS enrollments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE, enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ,
 access_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CONSTRAINT enrollments_access_status_check CHECK(access_status IN ('ACTIVE','SUSPENDED','REVOKED')),
 access_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), access_reason TEXT,
 UNIQUE(user_id,course_id)
);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS access_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS access_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS access_reason TEXT;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='enrollments_access_status_check' AND conrelid='enrollments'::regclass) THEN
  ALTER TABLE enrollments ADD CONSTRAINT enrollments_access_status_check CHECK(access_status IN ('ACTIVE','SUSPENDED','REVOKED'));
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS enrollments_user_idx ON enrollments(user_id); CREATE INDEX IF NOT EXISTS enrollments_course_idx ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS enrollments_access_idx ON enrollments(user_id,access_status,course_id);
CREATE TABLE IF NOT EXISTS lesson_progress (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
 lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, completed BOOLEAN NOT NULL DEFAULT TRUE,
 completed_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(enrollment_id,lesson_id)
);
CREATE INDEX IF NOT EXISTS progress_enrollment_idx ON lesson_progress(enrollment_id);
CREATE TABLE IF NOT EXISTS course_resources (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 title VARCHAR(180) NOT NULL, description TEXT,
 resource_type VARCHAR(20) NOT NULL DEFAULT 'LINK' CHECK(resource_type IN ('LINK','PDF','VIDEO','FILE')),
 url TEXT NOT NULL, is_published BOOLEAN NOT NULL DEFAULT TRUE,
 created_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS course_resources_course_idx ON course_resources(course_id,is_published);
CREATE TABLE IF NOT EXISTS audit_logs (
 id BIGSERIAL PRIMARY KEY, actor_id UUID REFERENCES users(id) ON DELETE SET NULL, action VARCHAR(80) NOT NULL,
 entity_type VARCHAR(80) NOT NULL, entity_id TEXT, metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_actor_idx ON audit_logs(actor_id); CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title VARCHAR(160) NOT NULL, message TEXT NOT NULL, type VARCHAR(20) NOT NULL DEFAULT 'INFO'
 CHECK(type IN ('INFO','SUCCESS','WARNING','ERROR')), href TEXT, is_read BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications(user_id,is_read) WHERE is_read=false;

CREATE TABLE IF NOT EXISTS evaluations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 title VARCHAR(180) NOT NULL, type VARCHAR(40) NOT NULL CHECK(type IN ('EXAM','PROJECT','PRACTICE','QUIZ')),
 due_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS evaluations_course_idx ON evaluations(course_id); CREATE INDEX IF NOT EXISTS evaluations_due_idx ON evaluations(due_at);
CREATE INDEX IF NOT EXISTS evaluations_active_course_idx ON evaluations(course_id,due_at) WHERE is_archived=FALSE;
CREATE TABLE IF NOT EXISTS evaluation_submissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SUBMITTED','CHANGES_REQUESTED','GRADED')),
 score NUMERIC(6,2), answer_text TEXT, attachment_data TEXT, attachment_name VARCHAR(255), attachment_mime VARCHAR(100),
 feedback TEXT, submitted_at TIMESTAMPTZ, reviewed_at TIMESTAMPTZ,
 reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL, UNIQUE(evaluation_id,user_id)
);
CREATE INDEX IF NOT EXISTS evaluation_submissions_status_idx ON evaluation_submissions(status,submitted_at DESC);

CREATE TABLE IF NOT EXISTS assignments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 title VARCHAR(180) NOT NULL, description TEXT, due_at TIMESTAMPTZ NOT NULL,
 max_score NUMERIC(6,2) NOT NULL DEFAULT 100 CHECK(max_score>0), is_published BOOLEAN NOT NULL DEFAULT TRUE,
 created_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS assignments_course_idx ON assignments(course_id); CREATE INDEX IF NOT EXISTS assignments_due_idx ON assignments(due_at);
CREATE INDEX IF NOT EXISTS assignments_active_course_idx ON assignments(course_id,due_at) WHERE is_archived=FALSE;
CREATE TABLE IF NOT EXISTS assignment_submissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, answer_text TEXT, attachment_data TEXT,
 attachment_name VARCHAR(255), attachment_mime VARCHAR(100),
 status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN ('SUBMITTED','CHANGES_REQUESTED','GRADED')),
 score NUMERIC(6,2), feedback TEXT, submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reviewed_at TIMESTAMPTZ,
 reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL, UNIQUE(assignment_id,user_id)
);
CREATE INDEX IF NOT EXISTS assignment_submissions_status_idx ON assignment_submissions(status,submitted_at DESC);
CREATE TABLE IF NOT EXISTS course_reviews (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, rating SMALLINT NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(course_id,user_id)
);
CREATE TABLE IF NOT EXISTS featured_instructors (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(120) NOT NULL, role VARCHAR(120) NOT NULL, initials VARCHAR(4) NOT NULL,
 tone VARCHAR(30) NOT NULL DEFAULT 'purple', rating NUMERIC(2,1) NOT NULL DEFAULT 5, student_count INTEGER NOT NULL DEFAULT 0,
 display_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS testimonials (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), quote TEXT NOT NULL, name VARCHAR(120) NOT NULL, role VARCHAR(120) NOT NULL,
 initials VARCHAR(4) NOT NULL, display_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS payment_settings (
 id SMALLINT PRIMARY KEY DEFAULT 1 CHECK(id=1), bank_name VARCHAR(120) NOT NULL, account_holder VARCHAR(160) NOT NULL,
 account_number VARCHAR(80) NOT NULL, account_type VARCHAR(80), currency VARCHAR(10) NOT NULL DEFAULT 'BOB',
 instructions TEXT, qr_image_url TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT, amount NUMERIC(10,2) NOT NULL CHECK(amount>0),
 status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
 payer_name VARCHAR(160) NOT NULL, reference VARCHAR(120), paid_at TIMESTAMPTZ NOT NULL,
 receipt_data TEXT NOT NULL, receipt_mime VARCHAR(80) NOT NULL, review_notes TEXT,
 reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL, reviewed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status,created_at DESC);
WITH duplicate_pending AS (
 SELECT id,row_number() OVER(PARTITION BY user_id,course_id ORDER BY created_at DESC,id DESC) duplicate_number
 FROM payments WHERE status='PENDING'
)
UPDATE payments p SET status='REJECTED',
 review_notes=concat_ws(E'\n',NULLIF(p.review_notes,''),'Cerrado automáticamente al consolidar solicitudes de pago duplicadas.'),
 reviewed_at=COALESCE(p.reviewed_at,NOW()),updated_at=NOW()
FROM duplicate_pending d WHERE p.id=d.id AND d.duplicate_number>1;
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_pending_per_course_idx ON payments(user_id,course_id) WHERE status='PENDING';
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS payment_id UUID UNIQUE REFERENCES payments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS surveys (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 title VARCHAR(180) NOT NULL,description TEXT,closes_at TIMESTAMPTZ NOT NULL,is_published BOOLEAN NOT NULL DEFAULT TRUE,
 created_by UUID REFERENCES users(id) ON DELETE SET NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS survey_questions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
 prompt TEXT NOT NULL,position INTEGER NOT NULL CHECK(position>0),UNIQUE(survey_id,position)
);
CREATE TABLE IF NOT EXISTS survey_responses (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,answers JSONB NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN ('SUBMITTED','CHANGES_REQUESTED','VERIFIED')),
 feedback TEXT, submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reviewed_at TIMESTAMPTZ,
 reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
 UNIQUE(survey_id,user_id)
);
CREATE INDEX IF NOT EXISTS surveys_course_idx ON surveys(course_id,closes_at);
CREATE INDEX IF NOT EXISTS surveys_active_course_idx ON surveys(course_id,closes_at) WHERE is_archived=FALSE;
CREATE INDEX IF NOT EXISTS survey_responses_status_idx ON survey_responses(status,submitted_at DESC);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS users_touch ON users; CREATE TRIGGER users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS courses_touch ON courses; CREATE TRIGGER courses_touch BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
