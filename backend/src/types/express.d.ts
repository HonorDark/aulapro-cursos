import type { Role } from './index'
declare global { namespace Express { interface Request { user?: { id:string; role:Role; email:string } } } }
export {}
