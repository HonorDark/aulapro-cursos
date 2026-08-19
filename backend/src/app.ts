import express from "express";
import cors from "cors";
import { env } from "./config/env";
import authRoutes from "./routes/auth";
import courseRoutes from "./routes/courses";
import learningRoutes from "./routes/learning";
import userRoutes from "./routes/users";
import adminRoutes from "./routes/admin";
import contentRoutes from "./routes/content";
import paymentRoutes from "./routes/payments";
import academicRoutes from "./routes/academic";
import notificationRoutes from "./routes/notifications";
import courseworkRoutes from "./routes/coursework";
import accountingRoutes from "./routes/accounting";
import managementRoutes from "./routes/management";
import { errorHandler, notFound } from "./middleware/error";
import { query } from "./config/database";
import {
  apiRateLimit,
  authRateLimit,
  securityHeaders,
} from "./middleware/security";
export const app = express();
app.set("trust proxy", env.trustProxy);
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(
  cors({
    origin: (origin, callback) =>
      callback(null, !origin || env.frontendUrls.includes(origin.replace(/\/$/, ""))),
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
  }),
);
app.use(express.json({ limit: "8mb" }));
app.use("/api", apiRateLimit);
app.get("/api/health/live", (_req, res) =>
  res.json({ success: true, data: { status: "alive" } }),
);
const readinessHandler: express.RequestHandler = async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ success: true, data: { status: "ready", database: "up" } });
  } catch (error) {
    console.error("Database readiness check failed", error);
    res.status(503).json({
      success: false,
      message: "Servicio temporalmente no disponible",
      data: { status: "not_ready", database: "down" },
    });
  }
};
app.get("/api/health", readinessHandler);
app.get("/api/health/ready", readinessHandler);
app.use("/api/auth", authRateLimit, authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/academic", academicRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/coursework", courseworkRoutes);
app.use("/api/accounting", accountingRoutes);
app.use("/api/management", managementRoutes);

app.use("/api", learningRoutes);

app.use(notFound);
app.use(errorHandler);
