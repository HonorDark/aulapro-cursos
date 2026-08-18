import {Router} from 'express'
import {query} from '../config/database'
import {asyncHandler} from '../utils/asyncHandler'
const router=Router()
router.get('/home',asyncHandler(async(_req,res)=>{const [instructors,testimonials,metrics]=await Promise.all([query('SELECT name,role,initials,tone,rating,student_count FROM featured_instructors WHERE is_active=true ORDER BY display_order'),query('SELECT quote,name,role,initials FROM testimonials WHERE is_active=true ORDER BY display_order'),query(`SELECT (SELECT COUNT(*) FROM users WHERE role='STUDENT' AND is_active=true)::int students,(SELECT COUNT(*) FROM courses WHERE is_published=true)::int courses,COALESCE((SELECT ROUND(AVG(rating)::numeric,1) FROM course_reviews),0) rating,(SELECT COUNT(*) FROM enrollments)::int enrollments`)]);res.json({success:true,data:{instructors:instructors.rows,testimonials:testimonials.rows,metrics:metrics.rows[0]}})}))
export default router
