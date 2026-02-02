"use client";

import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900">אזור ניהול</h2>
      <ul className="space-y-2">
        <li>
          <Link
            href="/admin/questionnaire"
            className="block rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50"
          >
            <span className="font-medium">בניית שאלון</span>
            <span className="mr-2 text-zinc-500">– גרסאות, שאלות, כללי תצוגה, תצוגה מקדימה</span>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/cases"
            className="block rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50"
          >
            <span className="font-medium">שליטה בדוחות</span>
            <span className="mr-2 text-zinc-500">– שלב, סטטוס, מחיר, איפוס, יומן אירועים</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
