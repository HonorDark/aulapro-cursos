import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pool} from '../config/database'
async function run(){for(const file of ['schema.sql','seed.sql']){const sql=await readFile(resolve(process.cwd(),'database',file),'utf8');await pool.query(sql)}const {rows}=await pool.query(`SELECT
 (SELECT COUNT(*) FROM enrollments e JOIN users u ON u.id=e.user_id WHERE u.email='student@aulapro.test')::int enrollments,
 (SELECT COUNT(*) FROM lesson_progress lp JOIN enrollments e ON e.id=lp.enrollment_id JOIN users u ON u.id=e.user_id WHERE u.email='student@aulapro.test' AND lp.completed)::int completed_lessons,
 (SELECT COUNT(*) FROM evaluations ev JOIN courses c ON c.id=ev.course_id JOIN enrollments e ON e.course_id=c.id JOIN users u ON u.id=e.user_id WHERE u.email='student@aulapro.test' AND ev.due_at>=NOW())::int upcoming_evaluations,
 (SELECT COUNT(*) FROM evaluation_submissions es JOIN users u ON u.id=es.user_id WHERE u.email='student@aulapro.test')::int submissions`);console.log('Base AulaFlow preparada con datos demo',rows[0])}
run().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>pool.end())
