"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiPath } from "@/lib/config";
import { authHeaders } from "@/lib/auth";

type CaseItem = {
  id: string;
  taxYear: number;
  workflowStep: string;
  status: string;
  paymentStatus: string;
  user?: { id: string; email: string };
  questionnaireVersion?: { taxYear: number; version: number };
};

export default function AdminCasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [taxYear, setTaxYear] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const fetchCases = () => {
    const params = new URLSearchParams();
    if (taxYear) params.set("taxYear", taxYear);
    if (status) params.set("status", status);
    const q = params.toString();
    fetch(apiPath(`/admin/cases${q ? `?${q}` : ""}`), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setCases(data.cases ?? []))
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCases();
  }, []);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900">דוחות – שליטה</h2>
        <Link href="/admin" className="text-zinc-600 hover:text-zinc-900">
          ← חזרה
        </Link>
      </div>

      <div className="flex flex-wrap gap-4 rounded-lg bg-white p-4 shadow">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">שנת מס</label>
          <input
            type="number"
            placeholder="הכל"
            value={taxYear}
            onChange={(e) => setTaxYear(e.target.value)}
            className="w-28 rounded-lg border border-zinc-300 px-3 py-2"
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">סטטוס</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2"
          >
            <option value="">הכל</option>
            <option value="New">New</option>
            <option value="InReview">InReview</option>
            <option value="MissingDocs">MissingDocs</option>
            <option value="ReadyToFile">ReadyToFile</option>
            <option value="Filed">Filed</option>
            <option value="Done">Done</option>
          </select>
        </div>
        <button
          type="button"
          onClick={fetchCases}
          className="self-end rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal"
        >
          חפש
        </button>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        {loading ? (
          <p className="text-zinc-600">טוען...</p>
        ) : cases.length === 0 ? (
          <p className="text-zinc-600">אין דוחות.</p>
        ) : (
          <ul className="space-y-2">
            {cases.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/cases/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50"
                >
                  <span className="font-medium">
                    {c.taxYear} – {c.user?.email ?? c.id}
                  </span>
                  <span className="text-zinc-500">
                    {c.workflowStep} | {c.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
