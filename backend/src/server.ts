import {app} from './app'
import {env} from './config/env'
import {pool} from './config/database'
const server=app.listen(env.port,()=>console.log(`AulaFlow API en http://localhost:${env.port}`))
const shutdown=()=>server.close(()=>pool.end().finally(()=>process.exit(0)))
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown)
