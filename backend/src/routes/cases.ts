import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { shouldShowQuestion } from "../rulesEngine";
import { WORKFLOW_STEPS, CASE_STATUSES } from "../constants";
import { getUploadDir, getCaseUploadDir, getSignaturesDir, ensureDir, saveBuffer } from "../upload";

const router = Router();

async function getCaseWithQuestionnaire(caseId: string, userId: string) {
  return prisma.case.findFirst({
    where: { id: caseId, userId },
    include: {
      questionnaireVersion: {
        include: {
          questions: {
            include: { options: true, displayRules: true },
            orderBy: { order: "asc" },
          },
        },
      },
      answers: true,
    },
  });
}

router.use(requireAuth);

type AuthRequest = Request & { user: { userId: string; email: string; role: string } };

/** GET /cases – list current user's cases */
router.get("/", async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const userId = r.user.userId;
  const taxYear = req.query.taxYear ? parseInt(String(req.query.taxYear), 10) : undefined;
  const cases = await prisma.case.findMany({
    where: { userId, ...(taxYear ? { taxYear } : {}) },
    orderBy: { updatedAt: "desc" },
    include: {
      questionnaireVersion: { select: { id: true, taxYear: true, version: true } },
    },
  });
  res.json({ cases });
});

/** POST /cases – create new case for a tax year */
router.post("/", async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const userId = r.user.userId;
  const taxYear = parseInt(req.body?.taxYear, 10);
  if (!Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100) {
    res.status(400).json({ error: "valid taxYear required" });
    return;
  }
  const existing = await prisma.case.findFirst({
    where: { userId, taxYear },
  });
  if (existing) {
    res.status(409).json({ error: "case_already_exists", caseId: existing.id });
    return;
  }
  const published = await prisma.questionnaireVersion.findFirst({
    where: { taxYear, state: "Published" },
    orderBy: { version: "desc" },
  });
  if (!published) {
    res.status(400).json({ error: "no_questionnaire_for_year", taxYear });
    return;
  }
  const caseRecord = await prisma.case.create({
    data: {
      userId,
      taxYear,
      questionnaireVersionId: published.id,
      workflowStep: WORKFLOW_STEPS[1],
      status: CASE_STATUSES[0],
      paymentStatus: "pending",
    },
    include: {
      questionnaireVersion: { select: { id: true, taxYear: true, version: true } },
    },
  });
  res.status(201).json(caseRecord);
});

/** GET /cases/:id – get one case (must belong to user) */
router.get("/:id", async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const userId = r.user.userId;
  const id = req.params.id;
  const caseRecord = await prisma.case.findFirst({
    where: { id, userId },
    include: {
      questionnaireVersion: { select: { id: true, taxYear: true, version: true, state: true } },
    },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  res.json(caseRecord);
});

/** POST /cases/:id/payment/complete – mark paid and advance to PersonalDetailsUploads (MVP stub) */
router.post("/:id/payment/complete", async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const userId = r.user.userId;
  const caseId = req.params.id;
  const amount = req.body?.amount != null ? Number(req.body.amount) : 0;
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, userId },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  if (caseRecord.workflowStep !== WORKFLOW_STEPS[3]) {
    res.status(400).json({ error: "wrong_step", expected: WORKFLOW_STEPS[3] });
    return;
  }
  await prisma.case.update({
    where: { id: caseId },
    data: {
      paymentStatus: "paid",
      price: amount,
      workflowStep: WORKFLOW_STEPS[4],
    },
  });
  const updated = await prisma.case.findFirst({
    where: { id: caseId, userId },
    include: {
      questionnaireVersion: { select: { id: true, taxYear: true, version: true } },
    },
  });
  res.json(updated);
});

/** GET /cases/:id/requirements – list requirements; ensure default docs for PersonalDetailsUploads */
router.get("/:id/requirements", async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const userId = r.user.userId;
  const caseId = req.params.id;
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, userId },
    include: { requirements: { include: { uploads: true } } },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  const step = caseRecord.workflowStep;
  const stepIdx = WORKFLOW_STEPS.indexOf(step as (typeof WORKFLOW_STEPS)[number]);
  const needPersonalDocs = stepIdx >= 4 && stepIdx <= 10;
  if (needPersonalDocs && caseRecord.requirements.length === 0) {
    await prisma.requirement.createMany({
      data: [
        { caseId, type: "document", key: "id_document", title: "תעודת זהות", instructions: "העלה צילום תעודת זהות", required: true },
        { caseId, type: "document", key: "license", title: "רישיון נהיגה (אם רלוונטי)", instructions: "העלה צילום רישיון", required: false },
      ],
    });
    const fresh = await prisma.case.findFirst({
      where: { id: caseId, userId },
      include: { requirements: { include: { uploads: true } } },
    });
    return res.json({ requirements: fresh!.requirements });
  }
  res.json({ requirements: caseRecord.requirements });
});

/** POST /cases/:id/requirements/:reqId/upload – upload file (base64 in body for MVP) */
router.post("/:id/requirements/:reqId/upload", async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const userId = r.user.userId;
  const caseId = req.params.id;
  const reqId = req.params.reqId;
  const { base64, fileName } = req.body ?? {};
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, userId },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  const requirement = await prisma.requirement.findFirst({
    where: { id: reqId, caseId },
  });
  if (!requirement) {
    res.status(404).json({ error: "requirement_not_found" });
    return;
  }
  if (!base64 || typeof base64 !== "string") {
    res.status(400).json({ error: "base64 required" });
    return;
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > 10 * 1024 * 1024) {
    res.status(400).json({ error: "file_too_large" });
    return;
  }
  const safeName = (fileName && typeof fileName === "string") ? path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_") : "upload";
  const relPath = path.join("cases", caseId, reqId, `${Date.now()}-${safeName}`);
  const fullPath = path.join(getUploadDir(), relPath);
  ensureDir(path.dirname(fullPath));
  saveBuffer(fullPath, buffer);
  const upload = await prisma.upload.create({
    data: {
      caseId,
      requirementId: reqId,
      filePath: relPath,
      fileType: path.extname(safeName) || undefined,
    },
  });
  await prisma.requirement.update({
    where: { id: reqId },
    data: { status: "uploaded" },
  });
  res.status(201).json(upload);
});

/** GET /cases/:id/uploads/:uploadId/download – stream file (auth required) */
router.get("/:id/uploads/:uploadId/download", async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const userId = r.user.userId;
  const caseId = req.params.id;
  const uploadId = req.params.uploadId;
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, userId },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  const upload = await prisma.upload.findFirst({
    where: { id: uploadId, caseId },
  });
  if (!upload) {
    res.status(404).json({ error: "upload_not_found" });
    return;
  }
  const fullPath = path.resolve(getUploadDir(), upload.filePath);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: "file_not_found" });
    return;
  }
  res.sendFile(fullPath, { headers: { "Content-Disposition": "attachment" } });
});

/** POST /cases/:id/signatures – submit POA signature (base64 PDF) */
router.post("/:id/signatures", async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const userId = r.user.userId;
  const caseId = req.params.id;
  const { signer, base64Pdf } = req.body ?? {};
  if (!signer || typeof signer !== "string") {
    res.status(400).json({ error: "signer required" });
    return;
  }
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, userId },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  const relPath = path.join("signatures", caseId, `${signer.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`);
  const fullPath = path.join(getUploadDir(), relPath);
  if (base64Pdf && typeof base64Pdf === "string") {
    const buffer = Buffer.from(base64Pdf, "base64");
    ensureDir(path.dirname(fullPath));
    saveBuffer(fullPath, buffer);
  }
  const signature = await prisma.signature.create({
    data: {
      caseId,
      signer,
      signedPdfPath: base64Pdf ? relPath : null,
      signedAt: new Date(),
      auditJson: { timestamp: new Date().toISOString(), ip: req.ip ?? req.socket?.remoteAddress },
    },
  });
  if (signer === "main" && caseRecord.workflowStep === WORKFLOW_STEPS[5]) {
    const isMarried = caseRecord.isMarried === true;
    await prisma.case.update({
      where: { id: caseId },
      data: { workflowStep: isMarried ? WORKFLOW_STEPS[6] : WORKFLOW_STEPS[8] },
    });
  } else if (signer === "spouse" && caseRecord.workflowStep === WORKFLOW_STEPS[7]) {
    await prisma.case.update({
      where: { id: caseId },
      data: { workflowStep: WORKFLOW_STEPS[8] },
    });
  }
  res.status(201).json(signature);
});

/** GET /cases/:id/spouse – get spouse data */
router.get("/:id/spouse", async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const userId = r.user.userId;
  const caseId = req.params.id;
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, userId },
    select: { spouseCasePart: true },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  res.json({ spouse: caseRecord.spouseCasePart ?? null });
});

/** PATCH /cases/:id/spouse – update spouse data */
router.patch("/:id/spouse", async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const userId = r.user.userId;
  const caseId = req.params.id;
  const spouse = req.body?.spouse;
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, userId },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  await prisma.case.update({
    where: { id: caseId },
    data: { spouseCasePart: spouse ?? undefined },
  });
  const updated = await prisma.case.findFirst({
    where: { id: caseId, userId },
    select: { spouseCasePart: true },
  });
  res.json({ spouse: updated?.spouseCasePart ?? null });
});

/** POST /cases/:id/advance-step – move to next workflow step (user confirmed step done) */
router.post("/:id/advance-step", async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const userId = r.user.userId;
  const caseId = req.params.id;
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, userId },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  const current = caseRecord.workflowStep;
  const idx = WORKFLOW_STEPS.indexOf(current as (typeof WORKFLOW_STEPS)[number]);
  if (idx < 0 || idx >= WORKFLOW_STEPS.length - 1) {
    res.status(400).json({ error: "cannot_advance" });
    return;
  }
  const nextStep = WORKFLOW_STEPS[idx + 1];
  if (nextStep === "SpouseFlow" && caseRecord.isMarried !== true) {
    await prisma.case.update({
      where: { id: caseId },
      data: { workflowStep: WORKFLOW_STEPS[8] },
    });
    const updated = await prisma.case.findFirst({
      where: { id: caseId, userId },
      include: { questionnaireVersion: { select: { id: true, taxYear: true, version: true } } },
    });
    return res.json(updated);
  }
  await prisma.case.update({
    where: { id: caseId },
    data: { workflowStep: nextStep },
  });
  const updated = await prisma.case.findFirst({
    where: { id: caseId, userId },
    include: { questionnaireVersion: { select: { id: true, taxYear: true, version: true } } },
  });
  res.json(updated);
});

/** POST /cases/:id/finish – set workflow to SubmittedToStaff */
router.post("/:id/finish", async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const userId = r.user.userId;
  const caseId = req.params.id;
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, userId },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  if (caseRecord.workflowStep !== WORKFLOW_STEPS[9]) {
    res.status(400).json({ error: "wrong_step", expected: WORKFLOW_STEPS[9] });
    return;
  }
  await prisma.case.update({
    where: { id: caseId },
    data: { workflowStep: WORKFLOW_STEPS[10] },
  });
  const updated = await prisma.case.findFirst({
    where: { id: caseId, userId },
    include: {
      questionnaireVersion: { select: { id: true, taxYear: true, version: true } },
    },
  });
  res.json(updated);
});

/** GET /cases/:id/questionnaire/next */
router.get("/:id/questionnaire/next", async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const userId = r.user.userId;
  const caseId = req.params.id;
  const caseRecord = await getCaseWithQuestionnaire(caseId, userId);
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  const answersMap: Record<string, unknown> = {};
  for (const a of caseRecord.answers) {
    answersMap[a.questionKey] = a.valueJson as unknown;
  }
  const questions = caseRecord.questionnaireVersion.questions;
  for (const q of questions) {
    if (answersMap[q.key] !== undefined) continue;
    if (!shouldShowQuestion(q.displayRules, answersMap)) continue;
    return res.json({
      question: {
        id: q.id,
        key: q.key,
        text: q.text,
        type: q.type,
        order: q.order,
        options: q.options.map((o) => ({ value: o.value, label: o.label })),
      },
    });
  }
  res.json({ question: null, done: true });
});

/** POST /cases/:id/questionnaire/answer */
router.post("/:id/questionnaire/answer", async (req: Request, res: Response) => {
  const r = req as AuthRequest;
  const userId = r.user.userId;
  const caseId = req.params.id;
  const { questionKey, value } = req.body ?? {};
  if (!questionKey || value === undefined) {
    res.status(400).json({ error: "questionKey and value required" });
    return;
  }
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, userId },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  const valueJson = typeof value === "object" ? value : { value };
  const existing = await prisma.answer.findFirst({
    where: { caseId, questionKey },
  });
  if (existing) {
    await prisma.answer.update({
      where: { id: existing.id },
      data: { valueJson },
    });
  } else {
    await prisma.answer.create({
      data: { caseId, questionKey, valueJson },
    });
  }
  if (questionKey === "q_married") {
    const isMarried = value === "yes" || (typeof value === "object" && value !== null && (value as { value?: string }).value === "yes");
    await prisma.case.update({
      where: { id: caseId },
      data: { isMarried },
    });
  }
  const answers = await prisma.answer.findMany({ where: { caseId } });
  const answersMap: Record<string, unknown> = {};
  for (const a of answers) {
    answersMap[a.questionKey] = a.valueJson as unknown;
  }
  const questions = await prisma.question.findMany({
    where: { versionId: caseRecord.questionnaireVersionId },
    include: { displayRules: true },
    orderBy: { order: "asc" },
  });
  let hasNext = false;
  for (const q of questions) {
    if (answersMap[q.key] !== undefined) continue;
    if (shouldShowQuestion(q.displayRules, answersMap)) {
      hasNext = true;
      break;
    }
  }
  await prisma.case.update({
    where: { id: caseId },
    data: { workflowStep: hasNext ? WORKFLOW_STEPS[2] : WORKFLOW_STEPS[3] },
  });
  res.json({ ok: true, hasNext });
});

export default router;
