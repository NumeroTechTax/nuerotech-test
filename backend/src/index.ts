import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import casesRoutes from "./routes/cases";
import adminQuestionnaireRoutes from "./routes/admin/questionnaire";
import adminCasesRoutes from "./routes/admin/cases";
import employeeCasesRoutes from "./routes/employee/cases";
import internalReminders from "./routes/internal/reminders";

const app = express();
const PORT = process.env.PORT ?? 10000;

const FRONTEND_URL = process.env.FRONTEND_URL ?? "https://tax-reports-web.onrender.com";

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "too_many_otp_requests" },
});
app.use("/auth/otp/send", otpLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "tax-reports-api" });
});

app.get("/", (_req, res) => {
  res.json({ message: "Tax Reports API", docs: "/health", auth: "/auth" });
});

app.use("/auth", authRoutes);
app.use("/cases", casesRoutes);
app.use("/admin/questionnaire", adminQuestionnaireRoutes);
app.use("/admin/cases", adminCasesRoutes);
app.use("/employee/cases", employeeCasesRoutes);
app.use("/internal", internalReminders);

app.listen(PORT, () => {
  console.log(`Tax Reports API listening on port ${PORT}`);
});
