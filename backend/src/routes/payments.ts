import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../config/database";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/errors";
import { audit } from "../services/audit";
import {
  createNotification,
  createRoleNotification,
} from "../services/notifications";

const router = Router();
router.use(authenticate);

router.get(
  "/settings",
  authorize("STUDENT"),
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      "SELECT bank_name,account_holder,account_number,account_type,currency,instructions,qr_image_url FROM payment_settings WHERE id=1",
    );
    if (!rows[0])
      throw new AppError(
        503,
        "La información bancaria todavía no fue configurada",
      );
    res.json({ success: true, data: rows[0] });
  }),
);

router.get(
  "/mine",
  authorize("STUDENT"),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT p.id,p.course_id,p.amount,p.status,p.reference,p.paid_at,p.review_notes,p.created_at,c.title,c.slug
    FROM payments p JOIN courses c ON c.id=p.course_id WHERE p.user_id=$1 ORDER BY p.created_at DESC`,
      [req.user!.id],
    );
    res.json({ success: true, data: rows });
  }),
);

router.post(
  "/",
  authorize("STUDENT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        courseId: z.string().uuid(),
        payerName: z.string().trim().min(3).max(160),
        reference: z.string().trim().max(120).optional(),
        paidAt: z.coerce.date(),
        receiptData: z.string().max(7_000_000),
        receiptMime: z.enum([
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
        ]),
      })
      .parse(req.body);
    if (!body.receiptData.startsWith(`data:${body.receiptMime};base64,`))
      throw new AppError(400, "El comprobante no tiene un formato válido");
    const course = await query<{ id: string; price: string; title: string }>(
      "SELECT id,price,title FROM courses WHERE id=$1 AND is_published=true",
      [body.courseId],
    );
    if (!course.rows[0]) throw new AppError(404, "Curso no disponible");
    if (Number(course.rows[0].price) <= 0)
      throw new AppError(400, "Este curso no requiere pago");
    const enrolled = await query(
      "SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2",
      [req.user!.id, body.courseId],
    );
    if (enrolled.rows[0])
      throw new AppError(409, "Ya estás inscrito en este curso");
    const pending = await query(
      "SELECT id FROM payments WHERE user_id=$1 AND course_id=$2 AND status=$3",
      [req.user!.id, body.courseId, "PENDING"],
    );
    if (pending.rows[0])
      throw new AppError(
        409,
        "Ya tienes un pago pendiente de verificación para este curso",
      );
    const { rows } = await query(
      `INSERT INTO payments(user_id,course_id,amount,payer_name,reference,paid_at,receipt_data,receipt_mime)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,status,amount,created_at`,
      [
        req.user!.id,
        body.courseId,
        course.rows[0].price,
        body.payerName,
        body.reference || null,
        body.paidAt,
        body.receiptData,
        body.receiptMime,
      ],
    );
    await audit(
      req.user!.id,
      "PAYMENT_SUBMITTED",
      "payment",
      (rows[0] as { id: string }).id,
      { courseId: body.courseId },
    );
    await createRoleNotification(
      ["ADMIN", "SUPER_ADMIN"],
      "Nuevo pago pendiente",
      `${body.payerName} envió un comprobante para “${course.rows[0].title}”.`,
      { type: "WARNING", href: "/admin/payments" },
    ).catch(() => undefined);
    res.status(201).json({ success: true, data: rows[0] });
  }),
);

router.get(
  "/admin",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? "");
    if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status))
      throw new AppError(400, "Estado inválido");
    const { rows } = await query(
      `SELECT p.id,p.amount,p.status,p.payer_name,p.reference,p.paid_at,p.receipt_mime,p.review_notes,p.reviewed_at,p.created_at,
    u.name student_name,u.email student_email,c.title course_title,r.name reviewer_name
    FROM payments p JOIN users u ON u.id=p.user_id JOIN courses c ON c.id=p.course_id LEFT JOIN users r ON r.id=p.reviewed_by
    WHERE ($1='' OR p.status=$1) ORDER BY CASE WHEN p.status='PENDING' THEN 0 ELSE 1 END,p.created_at DESC`,
      [status],
    );
    res.json({ success: true, data: rows });
  }),
);

router.get(
  "/admin/:id/receipt",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      "SELECT receipt_data,receipt_mime FROM payments WHERE id=$1",
      [req.params.id],
    );
    if (!rows[0]) throw new AppError(404, "Pago no encontrado");
    res.json({ success: true, data: rows[0] });
  }),
);

router.patch(
  "/admin/:id/review",
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        decision: z.enum(["APPROVED", "REJECTED"]),
        notes: z.string().trim().max(600).optional(),
      })
      .parse(req.body);
    const paymentId = String(req.params.id);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const payment = await client.query<{
        id: string;
        user_id: string;
        course_id: string;
        status: string;
      }>(
        "SELECT id,user_id,course_id,status FROM payments WHERE id=$1 FOR UPDATE",
        [paymentId],
      );
      if (!payment.rows[0]) throw new AppError(404, "Pago no encontrado");
      if (payment.rows[0].status !== "PENDING")
        throw new AppError(409, "Este pago ya fue revisado");
      await client.query(
        "UPDATE payments SET status=$1,review_notes=$2,reviewed_by=$3,reviewed_at=NOW(),updated_at=NOW() WHERE id=$4",
        [body.decision, body.notes || null, req.user!.id, paymentId],
      );
      if (body.decision === "APPROVED")
        await client.query(
          "INSERT INTO enrollments(user_id,course_id,payment_id) VALUES($1,$2,$3) ON CONFLICT(user_id,course_id) DO UPDATE SET payment_id=COALESCE(enrollments.payment_id,EXCLUDED.payment_id)",
          [payment.rows[0].user_id, payment.rows[0].course_id, paymentId],
        );
      await client.query("COMMIT");
      await audit(
        req.user!.id,
        body.decision === "APPROVED" ? "PAYMENT_APPROVED" : "PAYMENT_REJECTED",
        "payment",
        paymentId,
        { notes: body.notes ?? "" },
      );
      await createNotification(
        payment.rows[0].user_id,
        body.decision === "APPROVED" ? "Pago aprobado" : "Pago rechazado",
        body.decision === "APPROVED"
          ? "Tu pago fue verificado y el curso ya está disponible en tu panel."
          : `Tu comprobante necesita corrección.${body.notes ? ` Motivo: ${body.notes}` : ""}`,
        {
          type: body.decision === "APPROVED" ? "SUCCESS" : "ERROR",
          href: body.decision === "APPROVED" ? "/student" : "/student/courses",
        },
      ).catch(() => undefined);
      res.json({
        success: true,
        data: { id: paymentId, status: body.decision },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

router.patch(
  "/admin/:id/revise",
  authorize("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        decision: z.enum(["APPROVED", "REJECTED"]),
        notes: z.string().trim().min(3).max(600),
      })
      .parse(req.body);
    const paymentId = String(req.params.id);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{
        id: string;
        user_id: string;
        course_id: string;
        status: string;
      }>(
        "SELECT id,user_id,course_id,status FROM payments WHERE id=$1 FOR UPDATE",
        [paymentId],
      );
      const payment = result.rows[0];
      if (!payment) throw new AppError(404, "Pago no encontrado");
      if (payment.status === "PENDING")
        throw new AppError(
          409,
          "Los pagos pendientes deben revisarse desde la acción normal",
        );
      if (payment.status === body.decision)
        throw new AppError(409, "El pago ya tiene ese estado");
      await client.query(
        "UPDATE payments SET status=$1,review_notes=$2,reviewed_by=$3,reviewed_at=NOW(),updated_at=NOW() WHERE id=$4",
        [body.decision, body.notes, req.user!.id, paymentId],
      );
      if (body.decision === "APPROVED")
        await client.query(
          "INSERT INTO enrollments(user_id,course_id,payment_id) VALUES($1,$2,$3) ON CONFLICT(user_id,course_id) DO UPDATE SET payment_id=COALESCE(enrollments.payment_id,EXCLUDED.payment_id)",
          [payment.user_id, payment.course_id, paymentId],
        );
      else
        await client.query("DELETE FROM enrollments WHERE payment_id=$1", [
          paymentId,
        ]);
      await client.query("COMMIT");
      await audit(
        req.user!.id,
        "PAYMENT_DECISION_REVISED",
        "payment",
        paymentId,
        { from: payment.status, to: body.decision, notes: body.notes },
      );
      res.json({
        success: true,
        data: { id: paymentId, status: body.decision },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

export default router;
