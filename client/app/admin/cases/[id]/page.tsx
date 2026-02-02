"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiPath } from "@/lib/config";
import { authHeaders } from "@/lib/auth";

const WORKFLOW_STEPS = [
  "Auth",
  "SelectTaxYear",
  "Questionnaire",
  "Payment",
  "PersonalDetailsUploads",
  "POASignature",
  "SpouseFlow",
  "SpousePOASignature",
  "DocumentsAndData",
  "ReviewFinish",
  "SubmittedToStaff",
];

const CASE_STATUSES = ["New", "InReview", "MissingDocs", "ReadyToFile", "Filed", "Done"];

type CaseDetail = {
  id: string;
  taxYear: number;
  workflowStep: string;
  status: string;
  paymentStatus: string;
  price?: number;
  isMarried?: boolean;
  user?: { id: string; email: string };
  questionnaireVersion?: { taxYear: number; version: number };
  answers?: { questionKey: string; valueJson: unknown }[];
  requirements?: unknown[];
  signatures?: { signer: string; signedAt: string | null }[];
};

type EventItem = {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  payloadJson: unknown;
  createdAt: string;
};

export default function AdminCaseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowStep, setWorkflowStep] = useState("");
  const [status, setStatus] = useState("");
  const [price, setPrice] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchCase = useCallback(() => {
    if (!id) return;
    Promise.all([
      fetch(apiPath(`/admin/cases/${id}`), { headers: authHeaders() }).then((r) => r.json()),
      fetch(apiPath(`/admin/cases/${id}/events`), { headers: authHeaders() }).then((r) => r.json()),
    ])
      .then(([caseRes, eventsRes]) => {
        setCaseData(caseRes);
        setWorkflowStep(caseRes.workflowStep ?? "");
        setStatus(caseRes.status ?? "");
        setPrice(caseRes.price != null ? String(caseRes.price) : "");
        setEvents(eventsRes.events ?? []);
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  const handleSave = () => {
    setSaving(true);
    const body: { workflowStep?: string; status?: string; price?: number } = {};
    if (WORKFLOW_STEPS.includes(workflowStep)) body.workflowStep = workflowStep;
    if (CASE_STATUSES.includes(status)) body.status = status;
    const p = parseFloat(price);
    if (!Number.isNaN(p) && p >= 0) body.price = p;
    if (Object.keys(body).length === 0) {
      setSaving(false);
      return;
    }
    fetch(apiPath(`/admin/cases/${id}`), {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then(setCaseData)
      .catch(() => setError("שגיאה בשמירה"))
      .finally(() => setSaving(false));
  };

  const handleReset = (scope: string) => {
    setResetting(true);
    fetch(apiPath(`/admin/cases/${id}/reset`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ scope }),
    })
      .then((r) => r.json())
      .then(() => fetchCase())
      .catch(() => setError("שגיאה באיפוס"))
      .finally(() => setResetting(false));
  };

  if (loading || !caseData) {
    return (
      <div className="p-6" dir="rtl">
        {loading ? "טוען..." : "דוח לא נמצא."}
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900">
          דוח {caseData.taxYear} – {caseData.user?.email ?? id}
        </h2>
        <Link href="/admin/cases" className="text-zinc-600 hover:text-zinc-900">
          ← רשימת דוחות
        </Link>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 font-semibold text-zinc-900">שליטה בתהליך</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">שלב Workflow</label>
            <select
              value={workflowStep}
              onChange={(e) => setWorkflowStep(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            >
              {WORKFLOW_STEPS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">סטטוס</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            >
              {CASE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">מחיר</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
              dir="ltr"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-4 rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal disabled:opacity-60"
        >
          {saving ? "שומר..." : "שמור שינויים"}
        </button>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 font-semibold text-zinc-900">איפוס</h3>
        <p className="mb-4 text-sm text-zinc-600">
          איפוס שאלון – מוחק תשובות ומחזיר לשלב בחירת שנה. איפוס מסמכים – מוחק העלאות וחתימות. איפוס הכל – שניהם.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleReset("questionnaire")}
            disabled={resetting}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            איפוס שאלון
          </button>
          <button
            type="button"
            onClick={() => handleReset("documents")}
            disabled={resetting}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            איפוס מסמכים
          </button>
          <button
            type="button"
            onClick={() => handleReset("all")}
            disabled={resetting}
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            איפוס הכל
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 font-semibold text-zinc-900">יומן אירועים (Audit)</h3>
        {events.length === 0 ? (
          <p className="text-zinc-600">אין אירועים.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="rounded border border-zinc-200 p-3 text-sm">
                <span className="font-medium">{e.action}</span>
                <span className="mr-2 text-zinc-500">
                  {e.actorType} {e.actorId ?? ""} – {new Date(e.createdAt).toLocaleString("he-IL")}
                </span>
                {e.payloadJson != null ? (
                  <pre className="mt-1 overflow-auto rounded bg-zinc-100 p-2 text-xs" dir="ltr">
                    {JSON.stringify(e.payloadJson)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
