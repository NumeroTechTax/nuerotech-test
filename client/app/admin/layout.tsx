"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { apiPath } from "@/lib/config";
import { getToken, authHeaders, clearToken } from "@/lib/auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetch(apiPath("/auth/me"), { headers: authHeaders() })
      .then((res) => {
        if (res.status === 401) {
          clearToken();
          router.replace("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user?.role === "admin") setAllowed(true);
        else setAllowed(false);
      })
      .catch(() => setAllowed(false));
  }, [router]);

  if (allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50" dir="rtl">
        <p className="text-zinc-600">טוען...</p>
      </div>
    );
  }
  if (allowed === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6" dir="rtl">
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="mb-4 text-zinc-800">אין לך הרשאה לאזור זה.</p>
          <Link href="/dashboard" className="text-teal-dark hover:underline">
            חזרה ללוח הבקרה
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50" dir="rtl">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-900">ניהול</h1>
          <nav className="flex gap-4">
            <Link
              href="/admin"
              className={pathname === "/admin" ? "font-medium text-teal-dark" : "text-zinc-600 hover:text-zinc-900"}
            >
              בית
            </Link>
            <Link
              href="/admin/questionnaire"
              className={pathname?.startsWith("/admin/questionnaire") ? "font-medium text-teal-dark" : "text-zinc-600 hover:text-zinc-900"}
            >
              שאלונים
            </Link>
            <Link
              href="/admin/cases"
              className={pathname?.startsWith("/admin/cases") ? "font-medium text-teal-dark" : "text-zinc-600 hover:text-zinc-900"}
            >
              דוחות
            </Link>
            <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900">
              לוח בקרה
            </Link>
            <button
              type="button"
              onClick={() => {
                clearToken();
                router.push("/");
              }}
              className="text-zinc-600 hover:text-zinc-900"
            >
              התנתק
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
