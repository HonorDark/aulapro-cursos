import type {PublicUser} from '../types'
type UserRow={id:string;name:string;email:string;role:PublicUser['role'];avatar_url:string|null;is_active:boolean;created_at:Date}
export const publicUser=(u:UserRow):PublicUser=>({id:u.id,name:u.name,email:u.email,role:u.role,avatarUrl:u.avatar_url,isActive:u.is_active,createdAt:u.created_at.toISOString()})
