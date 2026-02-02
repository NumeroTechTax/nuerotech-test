/**
 * Evaluate display rules against case answers.
 * expression_json: { "and": [ { "questionKey": "q_married", "op": "eq", "value": "yes" } ] } or { "or": [...] }
 * Value in answers can be string or string[] (multi).
 */
type Condition = { questionKey: string; op: string; value: unknown };
type Expression = { and?: Condition[]; or?: Condition[] };

function getAnswerValue(answers: Record<string, unknown>, questionKey: string): unknown {
  const v = answers[questionKey];
  if (v === undefined) return undefined;
  if (typeof v === "object" && v !== null && "value" in v) return (v as { value: unknown }).value;
  return v;
}

function evalCondition(answers: Record<string, unknown>, c: Condition): boolean {
  const actual = getAnswerValue(answers, c.questionKey);
  const expected = c.value;
  switch (c.op) {
    case "eq":
      return actual === expected;
    case "ne":
      return actual !== expected;
    case "in":
      return Array.isArray(expected) && (expected as unknown[]).includes(actual);
    case "notIn":
      return Array.isArray(expected) && !(expected as unknown[]).includes(actual);
    case "contains":
      return Array.isArray(actual) && (actual as unknown[]).includes(expected);
    default:
      return false;
  }
}

function evalExpression(answers: Record<string, unknown>, expr: Expression): boolean {
  if (expr.and) {
    return expr.and.every((c) => evalCondition(answers, c));
  }
  if (expr.or) {
    return expr.or.some((c) => evalCondition(answers, c));
  }
  return true;
}

export function shouldShowQuestion(
  rules: { expressionJson: unknown }[],
  answers: Record<string, unknown>
): boolean {
  if (!rules.length) return true;
  return rules.every((r) => evalExpression(answers, (r.expressionJson as Expression) ?? {}));
}
