import 'dotenv/config'
const required=(name:string,fallback?:string)=>{const value=process.env[name]??fallback;if(!value)throw new Error(`Falta la variable ${name}`);return value}
export const env={port:Number(process.env.PORT??4000),databaseUrl:required('DATABASE_URL','postgresql://postgres:postgres@localhost:5432/aulapro'),jwtSecret:required('JWT_SECRET','dev-only-change-this-secret'),jwtExpiresIn:process.env.JWT_EXPIRES_IN??'8h',frontendUrl:process.env.FRONTEND_URL??'http://localhost:5173'}
