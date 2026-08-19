/**
 * Compatibilidad para las rutas existentes. El esquema se instala mediante
 * `npm run migrate`; nunca se ejecuta DDL durante una solicitud HTTP.
 */
export async function ensureProfileSchema() {
  return undefined;
}
