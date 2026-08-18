# AulaFlow

Demo full-stack de una plataforma de cursos con React, Express, TypeScript y PostgreSQL. Incluye catálogo, inscripción, aula virtual con progreso persistente y control de acceso real para `STUDENT`, `ADMIN` y `SUPER_ADMIN`.

## Roles y seguridad

- `STUDENT`: explora e ingresa únicamente a sus cursos, registra progreso y gestiona su perfil.
- `ADMIN`: consulta estadísticas, estudiantes e inscripciones, y administra/publica cursos y contenidos.
- `SUPER_ADMIN`: acceso global, usuarios, roles, activación de administradores y auditoría.
- El registro público siempre fuerza `STUDENT`. El backend valida cada operación con JWT y middleware de roles.
- Un administrador no puede modificar superadministradores. Un superadministrador no puede cambiar su propio rol, eliminar su propia cuenta ni desactivar/eliminar al último `SUPER_ADMIN` activo.
- Las contraseñas usan bcrypt (12 rondas). La recuperación usa tokens aleatorios, almacenados como SHA-256 y con 30 minutos de vigencia.

## Requisitos

- Node.js 20 o superior
- PostgreSQL 14 o superior

## Base de datos

Crear la base:

```sql
CREATE DATABASE aulapro;
```

Opción directa con `psql`:

```powershell
psql -U postgres -c "CREATE DATABASE aulapro;"
psql -U postgres -d aulapro -f backend/database/schema.sql
psql -U postgres -d aulapro -f backend/database/seed.sql
```

También se puede copiar `backend/.env.example` como `backend/.env`, ajustar `DATABASE_URL` y ejecutar desde `backend`:

```powershell
npm run seed
```

El seed es idempotente e incluye 6 cursos, 18 módulos, 54 lecciones, inscripciones y progreso de ejemplo.

## Variables de entorno

`backend/.env`:

```env
PORT=4000
DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/aulapro
JWT_SECRET=un-secreto-largo-aleatorio-de-al-menos-32-caracteres
JWT_EXPIRES_IN=8h
FRONTEND_URL=http://localhost:5173
```

`frontend/.env`:

```env
VITE_API_URL=http://localhost:4000/api
```

## Ejecución

En dos terminales:

```powershell
cd backend
npm install
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

Verificaciones disponibles: `npm run build` en ambas carpetas y `npm run lint` en `frontend`.

## Credenciales de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| STUDENT | `student@aulapro.test` | `Estudiante123!` |
| ADMIN | `admin@aulapro.test` | `Admin123!` |
| SUPER_ADMIN | `superadmin@aulapro.test` | `SuperAdmin123!` |

Estas claves se usan únicamente en datos de demostración; PostgreSQL recibe solo sus hashes bcrypt.

## API principal

- Autenticación: `/api/auth/register`, `/login`, `/me`, `/change-password`, `/forgot-password`, `/reset-password`
- Cursos y contenido: `/api/courses`, `/api/courses/:id/modules`, `/api/lessons`
- Aprendizaje: `/api/enrollments`, `/api/enrollments/me`, `/api/progress/:lessonId`
- Administración: `/api/admin/stats`, `/students`, `/enrollments`, `/activity`
- Superadministración: `/api/users`, `/api/users/admins`, `/api/users/:id/role`, `/status`

## Segunda etapa sugerida

Integrar un proveedor de correo para entregar enlaces de recuperación, almacenamiento de avatares y videos, pagos, certificados, edición visual completa de módulos/lecciones, paginación y pruebas automatizadas de integración/E2E.
