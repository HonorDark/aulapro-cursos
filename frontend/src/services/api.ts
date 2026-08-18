// Barrel de compatibilidad: el cliente HTTP compartido vive en shared/api.
export { api, ApiError, sessionToken } from "../shared/api/client";
export type { ApiResponse } from "../shared/api/client";
