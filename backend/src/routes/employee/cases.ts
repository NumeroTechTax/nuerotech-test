import { Router, Request, Response } from "express";
import { prisma } from "../../db";
import { requireAuth } from "../../middleware/auth";
import { requireEmployeeOrAdmin } from "../../middleware/requireRole";
import { CASE_STATUSES } from "../../constants";

const router = Router();

type AuthRequest = Request & { user: { userId: string; email: string; role: string } };

router.use(requireAuth);
router.use(requireEmployeeOrAdmin);

/** GET /employee/cases – list cases with filters (for Kanban) */
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

/** GET /employee/cases/:id – full case detail for employee (answers, requirements, uploads, signatures, events) */
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
  const events = await prisma.event.findMany({
    where: { caseId: id },
    orderBy: { createdAt: "desc" },
  });
  res.json({ ...caseRecord, events });
});

/** PATCH /employee/cases/:id – update status, assignedTo */
router.patch("/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  const userId = (req as AuthRequest).user.userId;
  const { status, assignedTo } = req.body ?? {};
  const caseRecord = await prisma.case.findUnique({
    where: { id },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  const data: { status?: string; assignedTo?: string | null } = {};
  if (status !== undefined && (CASE_STATUSES as readonly string[]).includes(status)) data.status = status;
  if (assignedTo !== undefined) data.assignedTo = assignedTo === "" ? null : assignedTo;
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "nothing_to_update" });
    return;
  }
  await prisma.case.update({
    where: { id },
    data,
  });
  await prisma.event.create({
    data: {
      actorType: (req as AuthRequest).user.role,
      actorId: userId,
      caseId: id,
      action: "case_update",
      payloadJson: data,
    },
  });
  const updated = await prisma.case.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true } },
      questionnaireVersion: { select: { id: true, taxYear: true, version: true } },
    },
  });
  res.json(updated);
});

export default router;
