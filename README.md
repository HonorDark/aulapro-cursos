# AulaFlow

AulaFlow es una plataforma de cursos construida con React, Express, TypeScript y PostgreSQL. Incluye catálogo, pagos por transferencia, aula virtual, progreso persistente, tareas, evaluaciones, encuestas y control de acceso para `STUDENT`, `ADMIN` y `SUPER_ADMIN`.

## Requisitos

- Node.js 20 o superior.
- PostgreSQL 14 o superior.
- Docker y Docker Compose, opcionales para un despliegue reproducible.

## Instalación local

1. Crea la base de datos y aplica el esquema en UTF-8:

```powershell
psql -U postgres -c "CREATE DATABASE aulaflow ENCODING 'UTF8';"
psql -v ON_ERROR_STOP=1 -U postgres -d aulaflow -f backend/database/schema.sql
```

2. Copia los archivos de entorno y reemplaza sus valores:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Genera `JWT_SECRET` con un valor aleatorio, por ejemplo:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

3. Instala y levanta ambos proyectos:

```powershell
cd backend
npm install
npm run migrate
npm run verify:readiness
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

La API queda disponible en `http://localhost:4000` y el frontend en `http://localhost:5173`.

## Migraciones

Las migraciones viven en `backend/database/migrations` y se ejecutan en orden por nombre. El runner:

- utiliza un bloqueo de PostgreSQL para impedir dos ejecuciones simultáneas;
- registra nombre y checksum en `schema_migrations`;
- aplica cada archivo dentro de una transacción;
- rechaza una migración ya aplicada si fue modificada.

Antes de migrar una instalación existente, crea un respaldo. Después ejecuta desde `backend`:

```powershell
npm run migrate
```

La migración de preparación para producción es idempotente. Añade versión de sesión, categorías desactivables y estado de acceso a inscripciones; consolida pagos pendientes duplicados y repara textos conocidos que pudieron importarse con una codificación incorrecta.

`000_runtime_schema_baseline.sql` reemplaza los antiguos DDL ejecutados durante las peticiones y permite actualizar una instalación que todavía no hubiera creado perfiles, notificaciones, recursos, tareas o campos de revisión. `001_production_readiness.sql` aplica las garantías de seguridad y consistencia. No edites una migración aplicada: agrega una nueva.

Una inscripción nunca debe eliminarse para revocar acceso. Sus estados son:

- `ACTIVE`: permite ingresar y continuar el curso.
- `SUSPENDED`: pausa temporalmente el acceso.
- `REVOKED`: retira el acceso sin borrar inscripción, entregas ni progreso.

## Datos de demostración local

El seed es idempotente y está guardado explícitamente como UTF-8:

```powershell
psql -v ON_ERROR_STOP=1 -U postgres -d aulaflow -f backend/database/seed.sql
```

Incluye cursos, módulos, lecciones, progreso, tareas, evaluaciones, encuestas y pagos coherentes. Los cursos pagos del estudiante demo tienen un pago aprobado enlazado; el curso gratuito no requiere pago. También crea un pago pendiente separado para probar la revisión administrativa.

| Rol | Correo | Contraseña |
|---|---|---|
| STUDENT | `student@aulapro.test` | `Estudiante123!` |
| ADMIN | `admin@aulapro.test` | `Admin123!` |
| SUPER_ADMIN | `superadmin@aulapro.test` | `SuperAdmin123!` |

Estas cuentas son únicamente para desarrollo local o una instancia aislada. No ejecutes `seed.sql`, no publiques estas contraseñas y no habilites accesos rápidos privilegiados en una demo pública. En el frontend, `VITE_ENABLE_PRIVILEGED_DEMO` debe permanecer en `false`; activarlo requiere una compilación nueva y solo es apropiado en una demo local controlada.

## Despliegue con Docker

El despliegue incluye PostgreSQL, API, migraciones automáticas, Nginx, proxy de `/api` y fallback para las rutas SPA.

```powershell
Copy-Item docker.env.example docker.env
# Completa POSTGRES_PASSWORD, DATABASE_URL y JWT_SECRET con secretos reales.
docker compose --env-file docker.env up --build -d
docker compose --env-file docker.env ps
```

Por defecto no se cargan usuarios ni contraseñas conocidas. Para crear el primer `SUPER_ADMIN`, completa temporalmente las tres variables `BOOTSTRAP_ADMIN_*` de `docker.env` y ejecuta:

```powershell
docker compose --env-file docker.env run --rm api node dist/scripts/bootstrap-super-admin.js
```

Después elimina esos tres valores del archivo. El bootstrap se niega a crear otra cuenta cuando ya existe un `SUPER_ADMIN` activo.

Para una demo exclusivamente local puede establecerse `AULAFLOW_LOAD_DEMO_DATA=true` antes de la primera creación del volumen PostgreSQL. Nunca uses ese valor en un entorno público. Los scripts de inicialización de PostgreSQL solo se ejecutan cuando el volumen está vacío.

La aplicación se publica en `http://localhost:8080` de forma predeterminada. Define `PUBLIC_ORIGIN` con el origen HTTPS definitivo y coloca TLS delante de Nginx en producción.

`POSTGRES_PASSWORD` contiene la clave real que recibe PostgreSQL. En `DATABASE_URL`, cualquier carácter reservado de esa clave debe estar codificado como URL y el host debe ser `db`, por ejemplo `postgresql://aulaflow:CLAVE_CODIFICADA@db:5432/aulaflow`.

## Despliegue con Apache o Laragon

El directorio `frontend/public` incluye `.htaccess`; Vite lo copia a `dist` y Apache redirige las rutas que no sean archivos reales hacia `index.html`. Deben estar habilitados `mod_rewrite` y `mod_headers`. Configura `VITE_API_URL` antes de compilar:

```powershell
cd frontend
$env:VITE_API_URL='https://tu-dominio.example/api'
$env:VITE_ENABLE_PRIVILEGED_DEMO='false'
npm run build
```

## Salud y operación

- `GET /api/health/live` comprueba que el proceso HTTP responde.
- `GET /api/health` y `GET /api/health/ready` comprueban también PostgreSQL.
- El healthcheck del contenedor de la API comprueba tanto HTTP como `SELECT 1` en PostgreSQL.
- El healthcheck web usa `/healthz`.
- El contenedor de API aplica migraciones pendientes antes de iniciar el servidor.
- El índice parcial `payments_one_pending_per_course_idx` impide más de un pago `PENDING` por estudiante y curso.
- `users.token_version` permite invalidar sesiones anteriores al cambiar contraseña, rol o estado de una cuenta.

Comandos operativos útiles:

```powershell
docker compose --env-file docker.env logs -f api
docker compose --env-file docker.env exec db pg_isready -U aulaflow -d aulaflow
docker compose --env-file docker.env exec db pg_dump -U aulaflow -d aulaflow -Fc -f /tmp/aulaflow.dump
```

Configura respaldos periódicos fuera del contenedor y verifica regularmente que puedan restaurarse.

## Variables de entorno principales

Backend:

- `DATABASE_URL`: conexión PostgreSQL.
- `JWT_SECRET`: secreto aleatorio obligatorio en producción.
- `JWT_EXPIRES_IN`: duración máxima de la sesión.
- `FRONTEND_URL`: origen exacto permitido por CORS.
- `TRUST_PROXY`: cantidad de proxies confiables; usa `1` con el Nginx incluido y `0` sin proxy.
- `NODE_ENV=production`: impide respuestas y utilidades exclusivas de desarrollo.

Frontend:

- `VITE_API_URL`: URL pública o ruta `/api` del backend.
- `VITE_ENABLE_PRIVILEGED_DEMO=false`: oculta accesos rápidos administrativos conocidos.

## Integraciones pendientes antes de producción real

Los comprobantes y adjuntos todavía pueden almacenarse en PostgreSQL. Las variables `STORAGE_*` y `S3_*` de `.env.example` documentan el contrato previsto, pero el adaptador de almacenamiento privado aún debe implementarse antes de manejar archivos reales a escala.

La recuperación genera tokens seguros y con expiración, pero el envío SMTP aún debe conectarse. Las variables `SMTP_*` y `PASSWORD_RESET_PUBLIC_URL` están preparadas para esa integración. En producción nunca se debe devolver el token de recuperación en la respuesta HTTP.

Antes de recibir usuarios reales también se recomienda:

- habilitar HTTPS, rate limiting y monitoreo centralizado;
- definir retención de auditoría y archivos;
- ejecutar pruebas de integración y E2E en CI;
- probar restauración de respaldos;
- revisar términos, privacidad y consentimiento;
- mover comprobantes, avatares y entregas a almacenamiento privado con URLs firmadas.

## Verificación

```powershell
cd backend
npm run build
npm test
npm run verify:readiness
```

```powershell
cd frontend
npm run build
npm run lint
```
