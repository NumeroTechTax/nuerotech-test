"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiPath } from "@/lib/config";
import { getToken, authHeaders } from "@/lib/auth";

type CaseData = {
  id: string;
  taxYear: number;
  workflowStep: string;
  status: string;
  paymentStatus: string;
  isMarried?: boolean;
  questionnaireVersion?: { taxYear: number; version: number };
};

type Requirement = {
  id: string;
  key: string;
  type: string;
  title: string | null;
  instructions: string | null;
  required: boolean;
  status: string;
  uploads?: { id: string; filePath: string }[];
};

export default function CaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCase = useCallback(() => {
    if (!id) return;
    fetch(apiPath(`/cases/${id}`), { headers: authHeaders() })
      .then((res) => {
        if (res.status === 401) router.replace("/login");
        if (!res.ok) throw new Error("case_not_found");
        return res.json();
      })
      .then(setCaseData)
      .catch(() => setError("דוח לא נמצא"))
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchCase();
  }, [fetchCase, router]);

  if (!getToken()) return null;
  if (loading && !caseData) return <div className="p-6" dir="rtl">טוען...</div>;
  if (error || !caseData) {
    return (
      <div className="p-6" dir="rtl">
        <p className="text-red-600">{error ?? "דוח לא נמצא"}</p>
        <Link href="/dashboard" className="text-teal-dark hover:underline mt-4 inline-block">חזרה ללוח</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6" dir="rtl">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900">← לוח דוחות</Link>
      </header>
      <div className="rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-bold text-zinc-900 mb-4">
          דוח שנת מס {caseData.taxYear}
        </h1>
        <p className="text-zinc-600 mb-2">שלב: {caseData.workflowStep}</p>
        <p className="text-zinc-600 mb-4">סטטוס: {caseData.status}</p>

        {caseData.workflowStep === "SelectTaxYear" && (
          <Link
            href={`/cases/${id}/questionnaire`}
            className="inline-block rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal"
          >
            המשך לשאלון
          </Link>
        )}
        {caseData.workflowStep === "Questionnaire" && (
          <Link
            href={`/cases/${id}/questionnaire`}
            className="inline-block rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal"
          >
            המשך שאלון
          </Link>
        )}
        {caseData.workflowStep === "Payment" && (
          <PaymentStep caseId={id} onDone={fetchCase} />
        )}
        {caseData.workflowStep === "PersonalDetailsUploads" && (
          <PersonalDetailsStep caseId={id} onDone={fetchCase} />
        )}
        {caseData.workflowStep === "POASignature" && (
          <POAStep caseId={id} signer="main" onDone={fetchCase} />
        )}
        {caseData.workflowStep === "SpouseFlow" && (
          <SpouseDetailsStep caseId={id} onDone={fetchCase} />
        )}
        {caseData.workflowStep === "SpousePOASignature" && (
          <POAStep caseId={id} signer="spouse" onDone={fetchCase} />
        )}
        {caseData.workflowStep === "DocumentsAndData" && (
          <DocumentsStep caseId={id} onDone={fetchCase} />
        )}
        {caseData.workflowStep === "ReviewFinish" && (
          <ReviewStep caseId={id} onDone={fetchCase} />
        )}
        {caseData.workflowStep === "SubmittedToStaff" && (
          <p className="text-green-700 font-medium">הדוח הוגש לעובדים. נעקוב אחרי עדכונים.</p>
        )}
      </div>
    </div>
  );
}

function PaymentStep({ caseId, onDone }: { caseId: string; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handlePay = () => {
    setSubmitting(true);
    setErr(null);
    fetch(apiPath(`/cases/${caseId}/payment/complete`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ amount: 0 }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("payment_failed");
        onDone();
      })
      .catch(() => setErr("שגיאה באישור תשלום"))
      .finally(() => setSubmitting(false));
  };

  return (
    <div>
      <p className="text-zinc-600 mb-4">שלב תשלום (סימולציה – לחץ לאישור).</p>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <button
        type="button"
        onClick={handlePay}
        disabled={submitting}
        className="rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal disabled:opacity-60"
      >
        {submitting ? "מאשר..." : "אישור תשלום"}
      </button>
    </div>
  );
}

function PersonalDetailsStep({ caseId, onDone }: { caseId: string; onDone: () => void }) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiPath(`/cases/${caseId}/requirements`), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setRequirements(data.requirements ?? []))
      .catch(() => setErr("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, [caseId]);

  const handleFile = (reqId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      if (!base64) return;
      fetch(apiPath(`/cases/${caseId}/requirements/${reqId}/upload`), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ base64, fileName: file.name }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("upload_failed");
          return fetch(apiPath(`/cases/${caseId}/requirements`), { headers: authHeaders() });
        })
        .then((r) => r.json())
        .then((data) => setRequirements(data.requirements ?? []))
        .catch(() => setErr("שגיאה בהעלאה"));
    };
    reader.readAsDataURL(file);
  };

  const handleAdvance = () => {
    setAdvancing(true);
    setErr(null);
    fetch(apiPath(`/cases/${caseId}/advance-step`), {
      method: "POST",
      headers: authHeaders(),
    })
      .then((r) => {
        if (!r.ok) throw new Error("advance_failed");
        onDone();
      })
      .catch(() => setErr("שגיאה בהמשך"))
      .finally(() => setAdvancing(false));
  };

  if (loading) return <p className="text-zinc-600">טוען דרישות...</p>;
  return (
    <div>
      <p className="text-zinc-600 mb-4">העלה מסמכים (תעודת זהות, רישיון).</p>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <ul className="mb-4 space-y-3">
        {requirements.map((r) => (
          <li key={r.id} className="rounded border border-zinc-200 p-3">
            <p className="font-medium text-zinc-900">{r.title ?? r.key}</p>
            {r.instructions && <p className="text-sm text-zinc-500">{r.instructions}</p>}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="mt-2 text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(r.id, f);
              }}
            />
            {r.uploads?.length ? <p className="mt-1 text-sm text-green-600">הועלה</p> : null}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleAdvance}
        disabled={advancing}
        className="rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal disabled:opacity-60"
      >
        {advancing ? "מעביר..." : "המשך ליפוי כוח"}
      </button>
    </div>
  );
}

function POAStep({
  caseId,
  signer,
  onDone,
}: {
  caseId: string;
  signer: "main" | "spouse";
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      if (!base64) return;
      setSubmitting(true);
      setErr(null);
      fetch(apiPath(`/cases/${caseId}/signatures`), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ signer, base64Pdf: base64 }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("signature_failed");
          onDone();
        })
        .catch(() => setErr("שגיאה בהעלאת חתימה"))
        .finally(() => setSubmitting(false));
    };
    reader.readAsDataURL(file);
  };

  const label = signer === "main" ? "חתימת יפוי כוח" : "חתימת יפוי כוח – בן/בת זוג";
  return (
    <div>
      <p className="text-zinc-600 mb-4">{label}: העלה קובץ PDF חתום.</p>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <input
        type="file"
        accept=".pdf"
        className="mb-2"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        disabled={submitting}
      />
      {submitting && <p className="text-sm text-zinc-500">שולח...</p>}
    </div>
  );
}

function SpouseDetailsStep({ caseId, onDone }: { caseId: string; onDone: () => void }) {
  const [spouse, setSpouse] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiPath(`/cases/${caseId}/spouse`), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setSpouse((data.spouse as Record<string, string>) ?? {}))
      .catch(() => {});
  }, [caseId]);

  const handleSave = () => {
    setSaving(true);
    setErr(null);
    fetch(apiPath(`/cases/${caseId}/spouse`), {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ spouse }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("save_failed");
      })
      .catch(() => setErr("שגיאה בשמירה"))
      .finally(() => setSaving(false));
  };

  const handleAdvance = () => {
    setAdvancing(true);
    setErr(null);
    fetch(apiPath(`/cases/${caseId}/advance-step`), {
      method: "POST",
      headers: authHeaders(),
    })
      .then((r) => {
        if (!r.ok) throw new Error("advance_failed");
        onDone();
      })
      .catch(() => setErr("שגיאה בהמשך"))
      .finally(() => setAdvancing(false));
  };

  return (
    <div>
      <p className="text-zinc-600 mb-4">פרטי בן/בת זוג.</p>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <div className="mb-4 space-y-2">
        <input
          type="text"
          placeholder="שם מלא"
          value={spouse.name ?? ""}
          onChange={(e) => setSpouse((s) => ({ ...s, name: e.target.value }))}
          className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2"
        />
        <input
          type="text"
          placeholder="ת.ז."
          value={spouse.idNumber ?? ""}
          onChange={(e) => setSpouse((s) => ({ ...s, idNumber: e.target.value }))}
          className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2"
          dir="ltr"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
        >
          שמור
        </button>
        <button
          type="button"
          onClick={handleAdvance}
          disabled={advancing}
          className="rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal disabled:opacity-60"
        >
          {advancing ? "מעביר..." : "המשך לחתימת בן/בת זוג"}
        </button>
      </div>
    </div>
  );
}

function DocumentsStep({ caseId, onDone }: { caseId: string; onDone: () => void }) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiPath(`/cases/${caseId}/requirements`), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setRequirements(data.requirements ?? []))
      .catch(() => setErr("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, [caseId]);

  const handleAdvance = () => {
    setAdvancing(true);
    setErr(null);
    fetch(apiPath(`/cases/${caseId}/advance-step`), {
      method: "POST",
      headers: authHeaders(),
    })
      .then((r) => {
        if (!r.ok) throw new Error("advance_failed");
        onDone();
      })
      .catch(() => setErr("שגיאה בהמשך"))
      .finally(() => setAdvancing(false));
  };

  if (loading) return <p className="text-zinc-600">טוען...</p>;
  return (
    <div>
      <p className="text-zinc-600 mb-4">מסמכים ונתונים מותנים (אם יש דרישות נוספות – העלה כאן).</p>
      {requirements.length > 0 && (
        <ul className="mb-4 space-y-2">
          {requirements.map((r) => (
            <li key={r.id}>
              {r.title ?? r.key} – {r.status}
            </li>
          ))}
        </ul>
      )}
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <button
        type="button"
        onClick={handleAdvance}
        disabled={advancing}
        className="rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal disabled:opacity-60"
      >
        {advancing ? "מעביר..." : "המשך לסיכום"}
      </button>
    </div>
  );
}

function ReviewStep({ caseId, onDone }: { caseId: string; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleFinish = () => {
    setSubmitting(true);
    setErr(null);
    fetch(apiPath(`/cases/${caseId}/finish`), {
      method: "POST",
      headers: authHeaders(),
    })
      .then((r) => {
        if (!r.ok) throw new Error("finish_failed");
        onDone();
      })
      .catch(() => setErr("שגיאה בשליחה"))
      .finally(() => setSubmitting(false));
  };

  return (
    <div>
      <p className="text-zinc-600 mb-4">סיכום – בדוק שהכל מלא ולחץ לסיום והגשה לעובדים.</p>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <button
        type="button"
        onClick={handleFinish}
        disabled={submitting}
        className="rounded-lg bg-teal-dark px-4 py-2 font-medium text-white hover:bg-teal disabled:opacity-60"
      >
        {submitting ? "שולח..." : "סיום והגשה"}
      </button>
    </div>
  );
}
