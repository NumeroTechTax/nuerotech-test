import { Router, Request, Response } from "express";
import { prisma } from "../../db";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/requireRole";
import { WORKFLOW_STEPS, CASE_STATUSES } from "../../constants";

const router = Router();

type AuthRequest = Request & { user: { userId: string; email: string; role: string } };

router.use(requireAuth);
router.use(requireAdmin);

function logEvent(
  actorType: string,
  actorId: string,
  caseId: string,
  action: string,
  payload?: unknown
) {
  return prisma.event.create({
    data: {
      actorType,
      actorId,
      caseId,
      action,
      payloadJson: payload ? (payload as object) : undefined,
    },
  });
}

/** GET /admin/cases – list all cases (admin) with optional filters */
router.get("/", async (req: Request, res: Response) => {
  const taxYear = req.query.taxYear ? parseInt(String(req.query.taxYear), 10) : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const assignedTo = typeof req.query.assignedTo === "string" ? req.query.assignedTo : undefined;
  const cases = await prisma.case.findMany({
    where: {
      ...(taxYear ? { taxYear } : {}),
      ...(status ? { status } : {}),
      ...(assignedTo ? { assignedTo } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { id: true, email: true } },
      questionnaireVersion: { select: { id: true, taxYear: true, version: true } },
    },
  });
  res.json({ cases });
});

/** GET /admin/cases/:id – get one case (admin) with full details */
router.get("/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  const caseRecord = await prisma.case.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true } },
      questionnaireVersion: { select: { id: true, taxYear: true, version: true } },
      answers: true,
      requirements: { include: { uploads: true } },
      signatures: true,
    },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  res.json(caseRecord);
});

/** GET /admin/cases/:id/events – audit log for case */
router.get("/:id/events", async (req: Request, res: Response) => {
  const caseId = req.params.id;
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  const events = await prisma.event.findMany({
    where: { caseId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ events });
});

/** PATCH /admin/cases/:id – update workflow_step, status, price (with audit) */
router.patch("/:id", async (req: Request, res: Response) => {
  const caseId = req.params.id;
  const userId = (req as AuthRequest).user.userId;
  const { workflowStep, status, price } = req.body ?? {};
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  const payload: { workflowStep?: string; status?: string; price?: number; previous?: unknown } = {};
  const data: { workflowStep?: string; status?: string; price?: { set: number } } = {};
  if (workflowStep !== undefined && (WORKFLOW_STEPS as readonly string[]).includes(workflowStep)) {
    payload.workflowStep = workflowStep;
    payload.previous = { workflowStep: caseRecord.workflowStep };
    data.workflowStep = workflowStep;
  }
  if (status !== undefined && (CASE_STATUSES as readonly string[]).includes(status)) {
    payload.status = status;
    (payload.previous as Record<string, unknown> ?? {})["status"] = caseRecord.status;
    data.status = status;
  }
  if (price !== undefined && typeof price === "number" && price >= 0) {
    payload.price = price;
    data.price = { set: price };
  }
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "nothing_to_update" });
    return;
  }
  await prisma.case.update({
    where: { id: caseId },
    data,
  });
  await logEvent("admin", userId, caseId, "case_update", payload);
  const updated = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      user: { select: { id: true, email: true } },
      questionnaireVersion: { select: { id: true, taxYear: true, version: true } },
    },
  });
  res.json(updated);
});

/** POST /admin/cases/:id/reset – reset questionnaire / documents / all (with audit) */
router.post("/:id/reset", async (req: Request, res: Response) => {
  const caseId = req.params.id;
  const userId = (req as AuthRequest).user.userId;
  const scope = req.body?.scope ?? "all";
  if (!["questionnaire", "documents", "all"].includes(scope)) {
    res.status(400).json({ error: "invalid_scope", allowed: ["questionnaire", "documents", "all"] });
    return;
  }
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  if (scope === "questionnaire" || scope === "all") {
    await prisma.answer.deleteMany({ where: { caseId } });
    await prisma.case.update({
      where: { id: caseId },
      data: { workflowStep: WORKFLOW_STEPS[1], isMarried: null },
    });
  }
  if (scope === "documents" || scope === "all") {
    const uploads = await prisma.upload.findMany({ where: { caseId }, select: { id: true } });
    await prisma.upload.deleteMany({ where: { caseId } });
    await prisma.requirement.updateMany({
      where: { caseId },
      data: { status: "missing" },
    });
    await prisma.signature.deleteMany({ where: { caseId } });
    if (scope === "documents") {
      const step = caseRecord.workflowStep;
      const idx = WORKFLOW_STEPS.indexOf(step as (typeof WORKFLOW_STEPS)[number]);
      if (idx >= 5) {
        await prisma.case.update({
          where: { id: caseId },
          data: { workflowStep: WORKFLOW_STEPS[4] },
        });
      }
    }
  }
  await logEvent("admin", userId, caseId, "case_reset", { scope });
  const updated = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      user: { select: { id: true, email: true } },
      questionnaireVersion: { select: { id: true, taxYear: true, version: true } },
    },
  });
  res.json(updated);
});

export default router;
