"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiPath } from "@/lib/config";
import { getToken, authHeaders } from "@/lib/auth";

type Option = { value: string; label: string };
type Question = {
  id: string;
  key: string;
  text: string;
  type: string;
  order: number;
  options: Option[];
};

export default function QuestionnairePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [question, setQuestion] = useState<Question | null | "done">(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<string | string[]>("");
  const [error, setError] = useState<string | null>(null);

  const fetchNext = () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(apiPath(`/cases/${id}/questionnaire/next`), { headers: authHeaders() })
      .then((res) => {
        if (res.status === 401) router.replace("/login");
        if (!res.ok) throw new Error("fetch_failed");
        return res.json();
      })
      .then((data) => {
        if (data.done || !data.question) setQuestion("done");
        else setQuestion(data.question);
        setSelected("");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    if (!id) return;
    fetchNext();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || question === "done" || typeof question === "string") return;
    setSubmitting(true);
    setError(null);
    const value = question.type === "multi" && Array.isArray(selected) ? selected : selected;
    try {
      const res = await fetch(apiPath(`/cases/${id}/questionnaire/answer`), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ questionKey: question.key, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "שגיאה בשמירה");
        return;
      }
      if (data.hasNext) fetchNext();
      else {
        setQuestion("done");
      }
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSubmitting(false);
    }
  };

  if (!getToken()) return null;
  if (loading && !question) return <div className="p-6" dir="rtl">טוען...</div>;

  if (question === "done") {
    return (
      <div className="min-h-screen bg-zinc-50 p-6" dir="rtl">
        <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-bold text-zinc-900 mb-4">סיימת את השאלון</h2>
          <p className="text-zinc-600 mb-6">המשך לשלב התשלום.</p>
          <Link
            href={`/cases/${id}`}
            className="inline-block rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal"
          >
            חזרה לדוח
          </Link>
        </div>
      </div>
    );
  }

  if (!question) return <div className="p-6" dir="rtl">טוען...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 p-6" dir="rtl">
      <header className="mb-6">
        <Link href={`/cases/${id}`} className="text-zinc-600 hover:text-zinc-900">← חזרה לדוח</Link>
      </header>
      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">{error}</p>
      )}
      <form onSubmit={handleSubmit} className="mx-auto max-w-md rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">{question.text}</h2>
        {question.type === "single" && (
          <div className="space-y-2">
            {question.options.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50">
                <input
                  type="radio"
                  name="answer"
                  value={o.value}
                  checked={selected === o.value}
                  onChange={() => setSelected(o.value)}
                  className="h-4 w-4 text-teal"
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        )}
        {question.type === "multi" && (
          <div className="space-y-2">
            {question.options.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50">
                <input
                  type="checkbox"
                  value={o.value}
                  checked={Array.isArray(selected) && selected.includes(o.value)}
                  onChange={(e) => {
                    const v = o.value;
                    setSelected((prev) => {
                      const arr = Array.isArray(prev) ? prev : prev ? [prev] : [];
                      if (e.target.checked) return arr.includes(v) ? arr : [...arr, v];
                      return arr.filter((x) => x !== v);
                    });
                  }}
                  className="h-4 w-4 rounded text-teal"
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        )}
        {question.type !== "single" && question.type !== "multi" && (
          <input
            type="text"
            value={typeof selected === "string" ? selected : ""}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-4 py-2"
            dir="auto"
          />
        )}
        <button
          type="submit"
          disabled={submitting || (question.type === "single" && !selected) || (question.type === "multi" && (!Array.isArray(selected) || selected.length === 0))}
          className="mt-6 w-full rounded-lg bg-teal-dark py-3 font-medium text-white hover:bg-teal disabled:opacity-60"
        >
          {submitting ? "שומר..." : "המשך"}
        </button>
      </form>
    </div>
  );
}
