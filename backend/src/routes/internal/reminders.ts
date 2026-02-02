import { Router, Request, Response } from "express";
import { prisma } from "../../db";
import { WORKFLOW_STEPS } from "../../constants";

const router = Router();

const SUBMITTED = WORKFLOW_STEPS[WORKFLOW_STEPS.length - 1];
const STALE_HOURS = parseInt(process.env.REMINDER_STALE_HOURS ?? "24", 10);

/** POST /internal/reminder-check – find stale cases and "send" reminder (stub). Call from cron. */
router.post("/reminder-check", async (req: Request, res: Response) => {
  const secret = req.headers["x-reminder-secret"] ?? req.body?.secret;
  const expected = process.env.REMINDER_SECRET;
  if (expected && secret !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const since = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);
  const cases = await prisma.case.findMany({
    where: {
      workflowStep: { not: SUBMITTED },
      updatedAt: { lt: since },
    },
    include: { user: { select: { email: true } } },
  });
  for (const c of cases) {
    // TODO: send email via Resend/SendGrid. For MVP we log.
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Reminder] case ${c.id} user ${c.user?.email ?? "?"} workflow ${c.workflowStep}`);
    }
  }
  res.json({ ok: true, reminded: cases.length });
});

export default router;
