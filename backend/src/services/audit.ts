import {query} from '../config/database'
export const audit=(actorId:string,action:string,entityType:string,entityId?:string,metadata:Record<string,unknown>={})=>query('INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[actorId,action,entityType,entityId??null,JSON.stringify(metadata)])
