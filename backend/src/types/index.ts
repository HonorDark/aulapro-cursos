export type Role = 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN'
export interface PublicUser { id:string; name:string; email:string; role:Role; avatarUrl:string|null; isActive:boolean; createdAt:string }
