import { Router, Request, Response } from "express";
import { prisma } from "../../db";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/requireRole";
import { QUESTIONNAIRE_VERSION_STATES } from "../../constants";
import { shouldShowQuestion } from "../../rulesEngine";

const router = Router();

type AuthRequest = Request & { user: { userId: string; email: string; role: string } };

router.use(requireAuth);
router.use(requireAdmin);

/** GET /admin/questionnaire/versions – list questionnaire versions */
router.get("/versions", async (req: AuthRequest, res: Response) => {
  const versions = await prisma.questionnaireVersion.findMany({
    orderBy: [{ taxYear: "desc" }, { version: "desc" }],
    include: { _count: { select: { questions: true } } },
  });
  res.json({ versions });
});

/** POST /admin/questionnaire/versions – create draft version */
router.post("/versions", async (req: AuthRequest, res: Response) => {
  const taxYear = parseInt(req.body?.taxYear, 10);
  if (!Number.isInteger(taxYear)) {
    res.status(400).json({ error: "taxYear required" });
    return;
  }
  const last = await prisma.questionnaireVersion.findFirst({
    where: { taxYear },
    orderBy: { version: "desc" },
  });
  const version = await prisma.questionnaireVersion.create({
    data: {
      taxYear,
      version: (last?.version ?? 0) + 1,
      state: QUESTIONNAIRE_VERSION_STATES[0],
      createdBy: req.user.userId,
    },
  });
  res.status(201).json(version);
});

/** POST /admin/questionnaire/versions/:id/clone – clone from previous year */
router.post("/versions/:id/clone", async (req: AuthRequest, res: Response) => {
  const id = req.params.id;
  const source = await prisma.questionnaireVersion.findUnique({
    where: { id },
    include: { questions: { include: { options: true, displayRules: true } } },
  });
  if (!source) {
    res.status(404).json({ error: "version_not_found" });
    return;
  }
  const newVersion = await prisma.questionnaireVersion.create({
    data: {
      taxYear: source.taxYear + 1,
      version: 1,
      state: QUESTIONNAIRE_VERSION_STATES[0],
      createdBy: req.user.userId,
    },
  });
  for (const q of source.questions) {
    const newQ = await prisma.question.create({
      data: {
        versionId: newVersion.id,
        key: q.key,
        text: q.text,
        type: q.type,
        order: q.order,
        pageGroup: q.pageGroup,
      },
    });
    if (q.options.length) {
      await prisma.option.createMany({
        data: q.options.map((o) => ({ questionId: newQ.id, value: o.value, label: o.label })),
      });
    }
    if (q.displayRules.length) {
      for (const r of q.displayRules) {
        await prisma.displayRule.create({
          data: { questionId: newQ.id, expressionJson: r.expressionJson },
        });
      }
    }
  }
  res.status(201).json(newVersion);
});

/** PATCH /admin/questionnaire/versions/:id/publish */
router.patch("/versions/:id/publish", async (req: AuthRequest, res: Response) => {
  const version = await prisma.questionnaireVersion.update({
    where: { id: req.params.id },
    data: { state: QUESTIONNAIRE_VERSION_STATES[1] },
  });
  res.json(version);
});

/** GET /admin/questionnaire/versions/:id/questions */
router.get("/versions/:id/questions", async (req: AuthRequest, res: Response) => {
  const questions = await prisma.question.findMany({
    where: { versionId: req.params.id },
    include: { options: true, displayRules: true },
    orderBy: { order: "asc" },
  });
  res.json({ questions });
});

/** POST /admin/questionnaire/versions/:id/questions */
router.post("/versions/:id/questions", async (req: AuthRequest, res: Response) => {
  const versionId = req.params.id;
  const { key, text, type, order, options } = req.body ?? {};
  if (!key || !text || !type) {
    res.status(400).json({ error: "key, text, type required" });
    return;
  }
  const question = await prisma.question.create({
    data: {
      versionId,
      key,
      text,
      type: type ?? "single",
      order: order ?? 0,
      options: options?.length
        ? { create: options.map((o: { value: string; label: string }) => ({ value: o.value, label: o.label })) }
        : undefined,
    },
    include: { options: true },
  });
  res.status(201).json(question);
});

/** PATCH /admin/questionnaire/questions/:qid */
router.patch("/questions/:qid", async (req: AuthRequest, res: Response) => {
  const { key, text, type, order } = req.body ?? {};
  const question = await prisma.question.update({
    where: { id: req.params.qid },
    data: { ...(key && { key }), ...(text && { text }), ...(type && { type }), ...(order !== undefined && { order }) },
    include: { options: true },
  });
  res.json(question);
});

/** DELETE /admin/questionnaire/questions/:qid */
router.delete("/questions/:qid", async (req: AuthRequest, res: Response) => {
  await prisma.question.delete({ where: { id: req.params.qid } });
  res.status(204).send();
});

/** PUT /admin/questionnaire/questions/:qid/options – replace options */
router.put("/questions/:qid/options", async (req: AuthRequest, res: Response) => {
  const qid = req.params.qid;
  const options = req.body?.options;
  if (!Array.isArray(options)) {
    res.status(400).json({ error: "options array required" });
    return;
  }
  await prisma.option.deleteMany({ where: { questionId: qid } });
  if (options.length) {
    await prisma.option.createMany({
      data: options.map((o: { value: string; label: string }) => ({
        questionId: qid,
        value: String(o.value),
        label: String(o.label),
      })),
    });
  }
  const updated = await prisma.question.findUnique({
    where: { id: qid },
    include: { options: true },
  });
  res.json(updated?.options ?? []);
});

/** POST /admin/questionnaire/questions/:qid/rules – add display rule */
router.post("/questions/:qid/rules", async (req: AuthRequest, res: Response) => {
  const qid = req.params.qid;
  const expressionJson = req.body?.expressionJson;
  if (!expressionJson || typeof expressionJson !== "object") {
    res.status(400).json({ error: "expressionJson required" });
    return;
  }
  const rule = await prisma.displayRule.create({
    data: { questionId: qid, expressionJson },
  });
  res.status(201).json(rule);
});

/** DELETE /admin/questionnaire/rules/:ruleId */
router.delete("/rules/:ruleId", async (req: AuthRequest, res: Response) => {
  await prisma.displayRule.delete({ where: { id: req.params.ruleId } });
  res.status(204).send();
});

/** POST /admin/questionnaire/versions/:id/preview – next question given simulated answers */
router.post("/versions/:id/preview", async (req: AuthRequest, res: Response) => {
  const versionId = req.params.id;
  const answers = req.body?.answers ?? {};
  const version = await prisma.questionnaireVersion.findUnique({
    where: { id: versionId },
    include: {
      questions: {
        include: { options: true, displayRules: true },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!version) {
    res.status(404).json({ error: "version_not_found" });
    return;
  }
  const answersMap: Record<string, unknown> =
    typeof answers === "object" && answers !== null ? answers : {};
  for (const q of version.questions) {
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
      done: false,
    });
  }
  res.json({ question: null, done: true });
});

export default router;
