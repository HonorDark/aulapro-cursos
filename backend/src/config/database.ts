import {Pool,type QueryResultRow} from 'pg'
import {env} from './env'
export const pool=new Pool({connectionString:env.databaseUrl})
export const query=<T extends QueryResultRow>(text:string,params:unknown[]=[])=>(pool.query<T>(text,params))
