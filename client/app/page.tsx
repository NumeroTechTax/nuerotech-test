"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6">
      <main className="flex max-w-md flex-col items-center gap-8 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Tax Reports Portal
        </h1>
        <p className="text-zinc-600">
          הכנת דוחות מס בישראל
        </p>
        <Link
          href="/login"
          className="rounded-lg bg-teal-dark px-6 py-3 font-medium text-white transition hover:bg-teal"
        >
          התחברות / הרשמה
        </Link>
      </main>
    </div>
  );
}
