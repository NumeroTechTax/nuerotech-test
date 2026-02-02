"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiPath } from "@/lib/config";
import { authHeaders } from "@/lib/auth";

const CASE_STATUSES = ["New", "InReview", "MissingDocs", "ReadyToFile", "Filed", "Done"];

type CaseDetail = {
  id: string;
  taxYear: number;
  workflowStep: string;
  status: string;
  paymentStatus: string;
  assignedTo: string | null;
  user?: { id: string; email: string };
  questionnaireVersion?: { taxYear: number; version: number };
  answers?: { questionKey: string; valueJson: unknown }[];
  requirements?: { id: string; key: string; title: string | null; status: string; uploads: { id: string }[] }[];
  signatures?: { id: string; signer: string; signedAt: string | null }[];
  events?: { id: string; action: string; actorType: string; actorId: string | null; payloadJson: unknown; createdAt: string }[];
};

export default function EmployeeCaseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"answers" | "documents" | "signatures" | "activity">("answers");
  const [status, setStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCase = useCallback(() => {
    if (!id) return;
    fetch(apiPath(`/employee/cases/${id}`), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        setCaseData(data);
        setStatus(data.status ?? "");
        setAssignedTo(data.assignedTo ?? "");
      })
      .catch(() => setCaseData(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  const handleSave = () => {
    setSaving(true);
    fetch(apiPath(`/employee/cases/${id}`), {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status, assignedTo: assignedTo || null }),
    })
      .then((r) => r.json())
      .then(setCaseData)
      .catch(() => {})
      .finally(() => setSaving(false));
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
          תיק דוח {caseData.taxYear} – {caseData.user?.email ?? id}
        </h2>
        <Link href="/employee" className="text-zinc-600 hover:text-zinc-900">
          ← Kanban
        </Link>
      </div>

      <div className="rounded-lg bg-white p-4 shadow">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">סטטוס</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2"
            >
              {CASE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">משויך ל</label>
            <input
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="מזהה עובד"
              className="rounded-lg border border-zinc-300 px-3 py-2"
              dir="ltr"
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal disabled:opacity-60"
          >
            {saving ? "שומר..." : "שמור"}
          </button>
        </div>
        <p className="text-sm text-zinc-500">
          שלב: {caseData.workflowStep} | תשלום: {caseData.paymentStatus}
        </p>
      </div>

      <div className="rounded-lg bg-white shadow">
        <div className="flex border-b border-zinc-200">
          {(["answers", "documents", "signatures", "activity"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium ${tab === t ? "border-b-2 border-teal-dark text-teal-dark" : "text-zinc-600 hover:text-zinc-900"}`}
            >
              {t === "answers" && "תשובות"}
              {t === "documents" && "מסמכים"}
              {t === "signatures" && "חתימות"}
              {t === "activity" && "פעילות"}
            </button>
          ))}
        </div>
        <div className="p-6">
          {tab === "answers" && (
            <ul className="space-y-2">
              {(caseData.answers ?? []).map((a) => (
                <li key={a.questionKey} className="rounded border border-zinc-100 p-2">
                  <span className="font-medium">{a.questionKey}:</span>{" "}
                  <span className="text-zinc-600">{JSON.stringify(a.valueJson)}</span>
                </li>
              ))}
              {(caseData.answers ?? []).length === 0 && <p className="text-zinc-500">אין תשובות.</p>}
            </ul>
          )}
          {tab === "documents" && (
            <ul className="space-y-2">
              {(caseData.requirements ?? []).map((r) => (
                <li key={r.id} className="rounded border border-zinc-100 p-2">
                  <span className="font-medium">{r.title ?? r.key}</span> – {r.status} ({r.uploads?.length ?? 0} קבצים)
                </li>
              ))}
              {(caseData.requirements ?? []).length === 0 && <p className="text-zinc-500">אין דרישות.</p>}
            </ul>
          )}
          {tab === "signatures" && (
            <ul className="space-y-2">
              {(caseData.signatures ?? []).map((s) => (
                <li key={s.id} className="rounded border border-zinc-100 p-2">
                  {s.signer} – {s.signedAt ? new Date(s.signedAt).toLocaleString("he-IL") : "לא נחתם"}
                </li>
              ))}
              {(caseData.signatures ?? []).length === 0 && <p className="text-zinc-500">אין חתימות.</p>}
            </ul>
          )}
          {tab === "activity" && (
            <ul className="space-y-2">
              {(caseData.events ?? []).map((e) => (
                <li key={e.id} className="rounded border border-zinc-100 p-2 text-sm">
                  <span className="font-medium">{e.action}</span> – {e.actorType} {e.actorId ?? ""} – {new Date(e.createdAt).toLocaleString("he-IL")}
                  {e.payloadJson != null ? (
                    <pre className="mt-1 overflow-auto rounded bg-zinc-100 p-1 text-xs" dir="ltr">
                      {JSON.stringify(e.payloadJson)}
                    </pre>
                  ) : null}
                </li>
              ))}
              {(caseData.events ?? []).length === 0 && <p className="text-zinc-500">אין אירועים.</p>}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
