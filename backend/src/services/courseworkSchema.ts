/**
 * Compatibilidad para las rutas existentes. Las tablas académicas se
 * administran mediante migraciones versionadas, no durante solicitudes HTTP.
 */
export async function ensureCourseworkSchema() {
  return undefined;
}
