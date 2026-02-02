"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiPath } from "@/lib/config";
import { authHeaders } from "@/lib/auth";

type Option = { id?: string; value: string; label: string };
type DisplayRule = { id: string; expressionJson: unknown };
type Question = {
  id: string;
  key: string;
  text: string;
  type: string;
  order: number;
  options: Option[];
  displayRules: DisplayRule[];
};
type Version = { id: string; taxYear: number; version: number; state: string };

const QUESTION_TYPES = ["single", "multi", "text"] as const;

export default function AdminQuestionnaireVersionPage() {
  const params = useParams();
  const router = useRouter();
  const versionId = params.versionId as string;
  const [version, setVersion] = useState<Version | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, unknown>>({});
  const [previewQuestion, setPreviewQuestion] = useState<Question | null | "done">(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchVersion = useCallback(() => {
    if (!versionId) return;
    Promise.all([
      fetch(apiPath("/admin/questionnaire/versions"), { headers: authHeaders() }).then((r) =>
        r.json()
      ),
      fetch(apiPath(`/admin/questionnaire/versions/${versionId}/questions`), {
        headers: authHeaders(),
      }).then((r) => r.json()),
    ])
      .then(([versionsData, questionsData]) => {
        const v = (versionsData.versions as Version[]).find((x) => x.id === versionId);
        if (v) setVersion(v);
        if (questionsData.questions) setQuestions(questionsData.questions);
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, [versionId]);

  useEffect(() => {
    fetchVersion();
  }, [fetchVersion]);

  const handlePublish = () => {
    if (!versionId) return;
    fetch(apiPath(`/admin/questionnaire/versions/${versionId}/publish`), {
      method: "PATCH",
      headers: authHeaders(),
    })
      .then((r) => r.json())
      .then((v) => setVersion((prev) => (prev ? { ...prev, state: v.state } : prev)))
      .catch(() => setError("שגיאה בפרסום"));
  };

  const handleClone = () => {
    if (!versionId) return;
    fetch(apiPath(`/admin/questionnaire/versions/${versionId}/clone`), {
      method: "POST",
      headers: authHeaders(),
    })
      .then((r) => r.json())
      .then((v) => router.push(`/admin/questionnaire/${v.id}`))
      .catch(() => setError("שגיאה בשכפול"));
  };

  const runPreview = () => {
    if (!versionId) return;
    setPreviewOpen(true);
    setPreviewQuestion(null);
    fetch(apiPath(`/admin/questionnaire/versions/${versionId}/preview`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ answers: previewAnswers }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.done || !data.question) setPreviewQuestion("done");
        else setPreviewQuestion(data.question);
      })
      .catch(() => setError("שגיאה בתצוגה מקדימה"));
  };

  if (loading || !version) {
    return (
      <div className="p-6" dir="rtl">
        {loading ? "טוען..." : "גרסה לא נמצאה."}
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/questionnaire" className="text-zinc-600 hover:text-zinc-900">
            ← גרסאות
          </Link>
          <h2 className="text-xl font-bold text-zinc-900">
            שאלון {version.taxYear} – גרסה {version.version} ({version.state})
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPreviewOpen(true);
              setTimeout(runPreview, 0);
            }}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            תצוגה מקדימה
          </button>
          {version.state === "Draft" && (
            <button
              type="button"
              onClick={handlePublish}
              className="rounded-lg bg-teal-dark px-4 py-2 text-sm font-medium text-white hover:bg-teal"
            >
              פרסם
            </button>
          )}
          <button
            type="button"
            onClick={handleClone}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            שכפל לשנה הבאה
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">שאלות</h3>
          {version.state === "Draft" && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded-lg bg-teal-dark px-4 py-2 text-sm font-medium text-white hover:bg-teal"
            >
              הוסף שאלה
            </button>
          )}
        </div>
        {questions.length === 0 ? (
          <p className="text-zinc-600">אין שאלות. הוסף שאלה (גרסה בטיוטה).</p>
        ) : (
          <ul className="space-y-4">
            {questions.map((q) => (
              <li key={q.id} className="rounded-lg border border-zinc-200 p-4">
                {editingId === q.id ? (
                  <QuestionForm
                    versionId={versionId}
                    question={q}
                    onSave={() => {
                      setEditingId(null);
                      fetchVersion();
                    }}
                    onCancel={() => setEditingId(null)}
                    authHeaders={authHeaders}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-zinc-900">
                        [{q.order}] {q.key} – {q.text}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        סוג: {q.type} | אפשרויות: {q.options.length} | כללים: {q.displayRules.length}
                      </p>
                    </div>
                    {version.state === "Draft" && (
                      <button
                        type="button"
                        onClick={() => setEditingId(q.id)}
                        className="text-sm text-teal-dark hover:underline"
                      >
                        ערוך
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {addOpen && version.state === "Draft" && (
        <QuestionForm
          versionId={versionId}
          onSave={() => {
            setAddOpen(false);
            fetchVersion();
          }}
          onCancel={() => setAddOpen(false)}
          authHeaders={authHeaders}
        />
      )}

      {previewOpen && (
        <PreviewModal
          questions={questions}
          previewAnswers={previewAnswers}
          setPreviewAnswers={setPreviewAnswers}
          previewQuestion={previewQuestion}
          runPreview={runPreview}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function QuestionForm({
  versionId,
  question,
  onSave,
  onCancel,
  authHeaders: getHeaders,
}: {
  versionId: string;
  question?: Question;
  onSave: () => void;
  onCancel: () => void;
  authHeaders: () => HeadersInit;
}) {
  const [key, setKey] = useState(question?.key ?? "");
  const [text, setText] = useState(question?.text ?? "");
  const [type, setType] = useState(question?.type ?? "single");
  const [order, setOrder] = useState(question?.order ?? 0);
  const [options, setOptions] = useState<Option[]>(
    question?.options?.length ? question.options : [{ value: "", label: "" }]
  );
  const [displayRules, setDisplayRules] = useState<DisplayRule[]>(question?.displayRules ?? []);
  const [newRuleJson, setNewRuleJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (question?.displayRules) setDisplayRules(question.displayRules);
  }, [question?.id]);

  const save = () => {
    if (!key.trim() || !text.trim()) {
      setErr("מפתח וטקסט חובה");
      return;
    }
    setSaving(true);
    setErr(null);
    if (question) {
      Promise.all([
        fetch(apiPath(`/admin/questionnaire/questions/${question.id}`), {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({ key, text, type, order }),
        }),
        fetch(apiPath(`/admin/questionnaire/questions/${question.id}/options`), {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({
            options: options.filter((o) => o.value.trim() || o.label.trim()),
          }),
        }),
      ])
        .then(([r1, r2]) => {
          if (!r1.ok || !r2.ok) throw new Error("שגיאה בעדכון");
          onSave();
        })
        .catch(() => setErr("שגיאה בשמירה"))
        .finally(() => setSaving(false));
    } else {
      fetch(apiPath(`/admin/questionnaire/versions/${versionId}/questions`), {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          key,
          text,
          type,
          order,
          options: options.filter((o) => o.value.trim() || o.label.trim()),
        }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("שגיאה ביצירה");
          onSave();
        })
        .catch(() => setErr("שגיאה בשמירה"))
        .finally(() => setSaving(false));
    }
  };

  return (
    <div className="space-y-4">
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">מפתח (key)</label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">סדר</label>
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            dir="ltr"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">טקסט השאלה</label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">סוג</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {(type === "single" || type === "multi") && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">אפשרויות (value, label)</label>
          {options.map((o, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <input
                type="text"
                placeholder="value"
                value={o.value}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = { ...next[i], value: e.target.value };
                  setOptions(next);
                }}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2"
                dir="ltr"
              />
              <input
                type="text"
                placeholder="label"
                value={o.label}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = { ...next[i], label: e.target.value };
                  setOptions(next);
                }}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2"
              />
              <button
                type="button"
                onClick={() => setOptions(options.filter((_, j) => j !== i))}
                className="text-red-600 hover:underline"
              >
                הסר
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setOptions([...options, { value: "", label: "" }])}
            className="text-sm text-teal-dark hover:underline"
          >
            + הוסף אפשרות
          </button>
        </div>
      )}
      {question && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">כללי תצוגה (DisplayRules)</label>
          <p className="mb-1 text-xs text-zinc-500">
            JSON: {"{ \"and\": [ { \"questionKey\": \"q_married\", \"op\": \"eq\", \"value\": \"yes\" } ] }"} או or
          </p>
          {displayRules.map((r) => (
            <div key={r.id} className="mb-2 flex items-center gap-2 rounded border border-zinc-200 bg-zinc-50 p-2">
              <pre className="flex-1 overflow-auto text-xs" dir="ltr">
                {JSON.stringify(r.expressionJson)}
              </pre>
              <button
                type="button"
                onClick={() => {
                  fetch(apiPath(`/admin/questionnaire/rules/${r.id}`), {
                    method: "DELETE",
                    headers: getHeaders(),
                  }).then(() => setDisplayRules((prev) => prev.filter((x) => x.id !== r.id)));
                }}
                className="text-red-600 hover:underline"
              >
                הסר
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder='{"and":[{"questionKey":"q_married","op":"eq","value":"yes"}]}'
              value={newRuleJson}
              onChange={(e) => setNewRuleJson(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => {
                try {
                  const expressionJson = JSON.parse(newRuleJson);
                  fetch(apiPath(`/admin/questionnaire/questions/${question.id}/rules`), {
                    method: "POST",
                    headers: getHeaders(),
                    body: JSON.stringify({ expressionJson }),
                  })
                    .then((r) => r.json())
                    .then((rule) => {
                      setDisplayRules((prev) => [...prev, rule]);
                      setNewRuleJson("");
                    });
                } catch {
                  setErr("JSON לא תקין");
                }
              }}
              className="rounded-lg bg-teal-dark px-4 py-2 text-sm text-white hover:bg-teal"
            >
              הוסף כלל
            </button>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal disabled:opacity-60"
        >
          {saving ? "שומר..." : "שמור"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-50"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}

function PreviewModal({
  questions,
  previewAnswers,
  setPreviewAnswers,
  previewQuestion,
  runPreview,
  onClose,
}: {
  questions: Question[];
  previewAnswers: Record<string, unknown>;
  setPreviewAnswers: (a: Record<string, unknown>) => void;
  previewQuestion: Question | null | "done";
  runPreview: () => void;
  onClose: () => void;
}) {
  const [answerInput, setAnswerInput] = useState("");
  const questionKeys = questions.map((q) => q.key);

  const setAnswer = (key: string, value: unknown) => {
    setPreviewAnswers({ ...previewAnswers, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900">תצוגה מקדימה</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900"
          >
            ✕
          </button>
        </div>
        <p className="mb-2 text-sm text-zinc-600">
          הזן תשובות סימולציה (מפתח:ערך, מופרדים בפסיק) או השאר ריק לראות השאלה הראשונה.
        </p>
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder='q_married:yes, q_employment:employee'
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2"
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => {
              const next: Record<string, unknown> = {};
              answerInput.split(",").forEach((part) => {
                const [k, v] = part.split(":").map((s) => s.trim());
                if (k && v !== undefined) next[k] = v;
              });
              setPreviewAnswers(next);
              setTimeout(runPreview, 0);
            }}
            className="rounded-lg bg-teal-dark px-4 py-2 text-white hover:bg-teal"
          >
            עדכן
          </button>
        </div>
        <div className="mb-4">
          <p className="text-sm font-medium text-zinc-700 mb-1">תשובות נוכחיות:</p>
          <pre className="rounded bg-zinc-100 p-2 text-xs" dir="ltr">
            {JSON.stringify(previewAnswers, null, 2)}
          </pre>
        </div>
        <button
          type="button"
          onClick={runPreview}
          className="mb-4 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          הצג שאלה הבאה
        </button>
        {previewQuestion === "done" && (
          <p className="rounded-lg bg-green-50 p-3 text-green-800">סוף השאלון (אין שאלה הבאה).</p>
        )}
        {previewQuestion && previewQuestion !== "done" && (
          <div className="rounded-lg border border-zinc-200 p-4">
            <p className="font-medium text-zinc-900">{previewQuestion.text}</p>
            <p className="mt-1 text-sm text-zinc-500">
              key: {previewQuestion.key} | type: {previewQuestion.type}
            </p>
            {previewQuestion.options?.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-sm text-zinc-600">
                {previewQuestion.options.map((o) => (
                  <li key={o.value}>
                    {o.value} → {o.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
