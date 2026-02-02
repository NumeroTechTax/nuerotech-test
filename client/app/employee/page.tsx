"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiPath } from "@/lib/config";
import { authHeaders } from "@/lib/auth";

const COLUMNS = ["New", "InReview", "MissingDocs", "ReadyToFile", "Filed", "Done"];

type CaseItem = {
  id: string;
  taxYear: number;
  workflowStep: string;
  status: string;
  assignedTo: string | null;
  user?: { id: string; email: string };
  questionnaireVersion?: { taxYear: number; version: number };
};

export default function EmployeeKanbanPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [taxYear, setTaxYear] = useState<string>("");

  const fetchCases = () => {
    const params = taxYear ? `?taxYear=${taxYear}` : "";
    fetch(apiPath(`/employee/cases${params}`), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setCases(data.cases ?? []))
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const byStatus = (status: string) => cases.filter((c) => c.status === status);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900">לוח Kanban – דוחות</h2>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="שנת מס"
            value={taxYear}
            onChange={(e) => setTaxYear(e.target.value)}
            className="w-28 rounded-lg border border-zinc-300 px-3 py-2"
            dir="ltr"
          />
          <button
            type="button"
            onClick={fetchCases}
            className="rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal"
          >
            רענן
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-zinc-600">טוען...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {COLUMNS.map((status) => (
            <div
              key={status}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow"
            >
              <h3 className="mb-3 font-semibold text-zinc-900">{status}</h3>
              <ul className="space-y-2">
                {byStatus(status).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/employee/cases/${c.id}`}
                      className="block rounded border border-zinc-100 bg-zinc-50 p-3 hover:bg-zinc-100"
                    >
                      <p className="text-sm font-medium text-zinc-900">
                        {c.taxYear} – {c.user?.email ?? c.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {c.workflowStep}
                        {c.assignedTo ? ` | ${c.assignedTo}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
