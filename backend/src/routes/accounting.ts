import { Router } from "express";
import { query } from "../config/database";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [summary, monthly, courses, movements, settings] = await Promise.all([
      query(
        `SELECT
          COALESCE(SUM(amount) FILTER(WHERE status='APPROVED'),0) total_revenue,
          COALESCE(SUM(amount) FILTER(WHERE status='APPROVED' AND reviewed_at>=date_trunc('month',NOW())),0) month_revenue,
          COALESCE(SUM(amount) FILTER(WHERE status='PENDING'),0) pending_amount,
          COALESCE(SUM(amount) FILTER(WHERE status='REJECTED'),0) rejected_amount,
          COUNT(*) FILTER(WHERE status='APPROVED')::int approved_count,
          COUNT(*) FILTER(WHERE status='PENDING')::int pending_count,
          COUNT(*) FILTER(WHERE status='REJECTED')::int rejected_count,
          COALESCE(AVG(amount) FILTER(WHERE status='APPROVED'),0) average_ticket
         FROM payments`,
      ),
      query(
        `WITH months AS (
           SELECT generate_series(
             date_trunc('month',NOW())-INTERVAL '5 months',
             date_trunc('month',NOW()),INTERVAL '1 month'
           ) month_start
         )
         SELECT to_char(m.month_start,'YYYY-MM') month_key,
           to_char(m.month_start,'Mon') label,
           COALESCE(SUM(p.amount),0) revenue,
           COUNT(p.id)::int transactions
         FROM months m LEFT JOIN payments p
           ON date_trunc('month',p.reviewed_at)=m.month_start AND p.status='APPROVED'
         GROUP BY m.month_start ORDER BY m.month_start`,
      ),
      query(
        `SELECT c.id,c.title,
          COALESCE(SUM(p.amount) FILTER(WHERE p.status='APPROVED'),0) revenue,
          COUNT(p.id) FILTER(WHERE p.status='APPROVED')::int sales,
          COALESCE(SUM(p.amount) FILTER(WHERE p.status='PENDING'),0) pending_amount,
          COUNT(p.id) FILTER(WHERE p.status='PENDING')::int pending_count
         FROM courses c LEFT JOIN payments p ON p.course_id=c.id
         GROUP BY c.id HAVING COUNT(p.id)>0
         ORDER BY revenue DESC,c.title`,
      ),
      query(
        `SELECT p.id,p.amount,p.status,p.payer_name,p.reference,p.paid_at,
          p.review_notes,p.reviewed_at,p.created_at,u.name student_name,u.email student_email,
          c.title course_title,r.name reviewer_name
         FROM payments p JOIN users u ON u.id=p.user_id
         JOIN courses c ON c.id=p.course_id
         LEFT JOIN users r ON r.id=p.reviewed_by
         ORDER BY p.created_at DESC LIMIT 100`,
      ),
      query("SELECT currency FROM payment_settings WHERE id=1"),
    ]);

    res.json({
      success: true,
      data: {
        currency: (settings.rows[0] as { currency?: string } | undefined)?.currency ?? "BOB",
        summary: summary.rows[0],
        monthly: monthly.rows,
        courses: courses.rows,
        movements: movements.rows,
      },
    });
  }),
);

export default router;
