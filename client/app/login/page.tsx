"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiPath } from "@/lib/config";

import { AUTH_TOKEN_KEY, setToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setToken(token);
      router.replace("/dashboard");
      return;
    }
    const err = searchParams.get("error");
    if (err) setError(err === "google_not_configured" ? "Google sign-in not configured" : "Sign-in failed");
  }, [searchParams, router]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(apiPath("/auth/otp/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to send code");
        return;
      }
      setStep("code");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(apiPath("/auth/otp/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Invalid or expired code");
        return;
      }
      setToken(data.token);
      router.push("/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = apiPath("/auth/google");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col" dir="rtl">
      {/* Top bar */}
      <header className="border-b border-gray-200 px-6 py-4 flex justify-end">
        <button
          type="button"
          className="p-2 text-teal-dark hover:bg-gray-100 rounded-lg"
          aria-label="תפריט"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      <main className="flex-1 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 px-6 py-12 max-w-6xl mx-auto w-full">
        {/* Illustration */}
        <div className="w-full max-w-md flex-shrink-0">
          <LoginIllustration />
        </div>

        {/* Form */}
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            יאללה, נתחיל?
          </h1>
          <p className="text-gray-600 mb-8 text-base">
            רק מקלידים את המייל ומקבלים מיד קוד חד פעמי להתחברות
          </p>

          {error && (
            <p className="mb-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {step === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  מייל
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-teal outline-none transition disabled:opacity-60"
                  dir="ltr"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-teal-dark hover:bg-teal text-white font-medium rounded-lg transition disabled:opacity-60"
              >
                {loading ? "שולח..." : "שלחו לי קוד"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-6">
              <p className="text-sm text-gray-600">
                הקוד נשלח ל־{email}
              </p>
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                  קוד
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-teal outline-none transition text-center text-lg tracking-widest disabled:opacity-60"
                  dir="ltr"
                />
              </div>
              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full py-3 px-4 bg-teal-dark hover:bg-teal text-white font-medium rounded-lg transition disabled:opacity-60"
              >
                {loading ? "בודק..." : "אישור"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("email"); setCode(""); setError(null); }}
                className="w-full py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                חזרה למייל
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="mt-6 w-full py-3 px-4 border border-gray-300 bg-white hover:bg-gray-50 font-medium rounded-lg flex items-center justify-center gap-3 transition"
          >
            <GoogleIcon className="w-5 h-5" />
            <span>התחברו עם גוגל</span>
          </button>

          <p className="mt-8 text-xs text-gray-500 leading-relaxed">
            הקלדת המייל מהווה הסכמה לתנאי השימוש ומדיניות הפרטיות
          </p>
          <p className="mt-1 text-xs text-gray-500">
            לא נשתמש במידע שלך למטרות שיווק
          </p>
        </div>
      </main>

      {/* ESC hint */}
      <div className="fixed bottom-4 left-4">
        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-dark text-white text-xs font-medium">
          ESC
        </span>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function LoginIllustration() {
  return (
    <svg
      viewBox="0 0 400 300"
      className="w-full h-auto text-teal-dark"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Laptop */}
      <rect x="120" y="160" width="160" height="100" rx="4" />
      <rect x="130" y="170" width="140" height="75" rx="2" fill="currentColor" fillOpacity="0.1" />
      <circle cx="200" cy="205" r="4" fill="currentColor" />
      <line x1="160" y1="260" x2="240" y2="260" strokeWidth="2" />
      {/* Person 1 (left) */}
      <circle cx="100" cy="120" r="25" />
      <path d="M85 160 Q100 150 115 160" />
      <line x1="90" y1="185" x2="85" y2="230" />
      <line x1="110" y1="185" x2="115" y2="230" />
      <path d="M75 100 Q85 90 95 95" />
      {/* Person 2 (right) */}
      <circle cx="300" cy="120" r="25" />
      <path d="M285 160 Q300 150 315 160" />
      <line x1="290" y1="185" x2="285" y2="230" />
      <line x1="310" y1="185" x2="315" y2="230" />
      <path d="M305 95 Q315 90 325 100" />
      {/* Envelope with bird */}
      <g transform="translate(200 50)">
        <path d="M0 0 L20 -15 L40 0 L20 15 Z" fill="none" />
        <circle cx="20" cy="-5" r="6" />
        <path d="M14 -8 Q20 -14 26 -8" />
      </g>
    </svg>
  );
}
