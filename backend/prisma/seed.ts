import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const taxYear = 2024;
  const existing = await prisma.questionnaireVersion.findFirst({
    where: { taxYear, state: "Published" },
  });
  if (existing) {
    console.log("Seed already applied: published questionnaire for", taxYear);
    return;
  }
  const version = await prisma.questionnaireVersion.create({
    data: {
      taxYear,
      version: 1,
      state: "Published",
    },
  });
  const q1 = await prisma.question.create({
    data: {
      versionId: version.id,
      key: "q_married",
      text: "האם את/ה נשוי/נשואה?",
      type: "single",
      order: 0,
    },
  });
  await prisma.option.createMany({
    data: [
      { questionId: q1.id, value: "yes", label: "כן" },
      { questionId: q1.id, value: "no", label: "לא" },
    ],
  });
  const q2 = await prisma.question.create({
    data: {
      versionId: version.id,
      key: "q_employment",
      text: "מה סטטוס התעסוקה שלך?",
      type: "single",
      order: 1,
    },
  });
  await prisma.option.createMany({
    data: [
      { questionId: q2.id, value: "employee", label: "שכיר" },
      { questionId: q2.id, value: "self", label: "עצמאי" },
      { questionId: q2.id, value: "both", label: "שכיר ועצמאי" },
      { questionId: q2.id, value: "other", label: "אחר" },
    ],
  });
  console.log("Seed done: questionnaire version", version.id, "for tax year", taxYear);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
