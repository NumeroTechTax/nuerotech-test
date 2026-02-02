"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiPath } from "@/lib/config";
import { getToken, authHeaders, clearToken } from "@/lib/auth";

type CaseItem = {
  id: string;
  taxYear: number;
  workflowStep: string;
  status: string;
  createdAt: string;
  questionnaireVersion?: { taxYear: number; version: number };
};

export default function DashboardPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createYear, setCreateYear] = useState(new Date().getFullYear());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    fetch(apiPath("/auth/me"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role);
      })
      .catch(() => {});
    fetch(apiPath("/cases"), { headers: authHeaders() })
      .then((res) => {
        if (res.status === 401) {
          clearToken();
          router.replace("/login");
          return [];
        }
        return res.json();
      })
      .then((data) => {
        if (data.cases) setCases(data.cases);
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch(apiPath("/cases"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ taxYear: createYear }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "case_already_exists" && data.caseId) {
          router.push(`/cases/${data.caseId}`);
          return;
        }
        setError(data.error === "no_questionnaire_for_year" ? `אין שאלון לשנת ${createYear}` : "יצירת דוח נכשלה");
        return;
      }
      router.push(`/cases/${data.id}`);
    } catch {
      setError("שגיאת רשת");
    } finally {
      setCreating(false);
    }
  };

  const token = getToken();
  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50 p-6" dir="rtl">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">דוחות מס</h1>
        <div className="flex items-center gap-4">
          {(userRole === "admin" || userRole === "employee") && (
            <Link href="/employee" className="text-sm text-teal-dark hover:underline">
              עובדים
            </Link>
          )}
          {userRole === "admin" && (
            <Link href="/admin" className="text-sm text-teal-dark hover:underline">
              ניהול
            </Link>
          )}
          <button
            type="button"
            onClick={() => { clearToken(); router.push("/"); }}
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            התנתק
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <section className="mb-8 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">דוח חדש</h2>
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
              value={createYear}
              onChange={(e) => setCreateYear(parseInt(e.target.value, 10) || createYear)}
              className="w-28 rounded-lg border border-zinc-300 px-3 py-2"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal disabled:opacity-60"
          >
            {creating ? "יוצר..." : "התחל דוח"}
          </button>
        </form>
      </section>

      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">המשך דוח קיים</h2>
        {loading ? (
          <p className="text-zinc-600">טוען...</p>
        ) : cases.length === 0 ? (
          <p className="text-zinc-600">אין דוחות. התחל דוח חדש למעלה.</p>
        ) : (
          <ul className="space-y-2">
            {cases.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cases/${c.id}`}
                  className="block rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50"
                >
                  <span className="font-medium">שנת מס {c.taxYear}</span>
                  <span className="mr-2 text-zinc-500">| שלב: {c.workflowStep} | סטטוס: {c.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
