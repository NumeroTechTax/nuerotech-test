"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiPath } from "@/lib/config";
import { authHeaders } from "@/lib/auth";

type Version = {
  id: string;
  taxYear: number;
  version: number;
  state: string;
  _count?: { questions: number };
};

export default function AdminQuestionnairePage() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = () => {
    fetch(apiPath("/admin/questionnaire/versions"), { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (data.versions) setVersions(data.versions);
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    fetch(apiPath("/admin/questionnaire/versions"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ taxYear: newYear }),
    })
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (!res.ok) throw new Error(d.error ?? "יצירה נכשלה");
        fetchVersions();
      })
      .catch((err) => setError(err.message ?? "שגיאה"))
      .finally(() => setCreating(false));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900">גרסאות שאלון</h2>
        <Link href="/admin" className="text-zinc-600 hover:text-zinc-900">
          ← חזרה
        </Link>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 font-semibold text-zinc-900">גרסה חדשה (טיוטה)</h3>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="taxYear" className="block text-sm font-medium text-zinc-700 mb-1">
              שנת מס
            </label>
            <input
              id="taxYear"
              type="number"
              min="2020"
              max="2030"
              value={newYear}
              onChange={(e) => setNewYear(parseInt(e.target.value, 10) || newYear)}
              className="w-28 rounded-lg border border-zinc-300 px-3 py-2"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal disabled:opacity-60"
          >
            {creating ? "יוצר..." : "צור גרסה"}
          </button>
        </form>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 font-semibold text-zinc-900">גרסאות קיימות</h3>
        {loading ? (
          <p className="text-zinc-600">טוען...</p>
        ) : versions.length === 0 ? (
          <p className="text-zinc-600">אין גרסאות. צור גרסה חדשה למעלה.</p>
        ) : (
          <ul className="space-y-2">
            {versions.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/admin/questionnaire/${v.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50"
                >
                  <span className="font-medium">
                    שנת מס {v.taxYear} – גרסה {v.version}
                  </span>
                  <span className="text-zinc-500">
                    {v.state} | {v._count?.questions ?? 0} שאלות
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
