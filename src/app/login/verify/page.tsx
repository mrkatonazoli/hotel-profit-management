"use client";

import { Suspense, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, Loader2 } from "lucide-react";

function VerifyForm() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  function handleChange(idx: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    if (digit && idx < 5) inputs.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      inputs.current[5]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = code.join("");
    if (token.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const url = new URL(window.location.href);
      const email = url.searchParams.get("email") ?? "";
      const res = await fetch(
        `/api/auth/callback/nodemailer?token=${token}&email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`
      );
      if (res.ok || res.redirected) {
        router.push(callbackUrl);
      } else {
        setError("Érvénytelen vagy lejárt kód. Kérj újat.");
      }
    } catch {
      setError("Hiba történt. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  const full = code.every((c) => c !== "");

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
        {code.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => { inputs.current[idx] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            className="w-12 h-14 text-center text-xl font-bold rounded-xl outline-none transition-all"
            style={{
              background: "#1E293B",
              border: `1px solid ${digit ? "#7C3AED" : "#334155"}`,
              color: "#F8FAFC",
              caretColor: "#7C3AED",
              fontVariantNumeric: "tabular-nums",
              boxShadow: digit ? "0 0 0 3px rgba(124,58,237,0.15)" : "none",
            }}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-center mb-4" style={{ color: "#EF4444" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!full || loading}
        className="w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "#7C3AED", color: "white" }}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Ellenőrzés...
          </>
        ) : (
          "Bejelentkezés"
        )}
      </button>
    </form>
  );
}

export default function VerifyPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ background: "#0F172A" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "#7C3AED" }}
          >
            <TrendingUp size={20} color="white" />
          </div>
          <span className="font-bold text-xl" style={{ color: "#F8FAFC" }}>
            HeyMax!
          </span>
        </div>

        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold mb-2" style={{ color: "#F8FAFC" }}>
            Add meg a kódot
          </h2>
          <p className="text-sm" style={{ color: "#64748B" }}>
            6 jegyű kódot küldtünk az e-mail címedre.
            <br />
            Ellenőrizd a spam mappát is.
          </p>
        </div>

        <Suspense fallback={
          <div className="flex gap-3 justify-center mb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="w-12 h-14 rounded-xl animate-pulse"
                style={{ background: "#1E293B" }}
              />
            ))}
          </div>
        }>
          <VerifyForm />
        </Suspense>

        <button
          className="mt-6 w-full text-sm text-center transition-colors"
          style={{ color: "#475569" }}
          onClick={() => router.push("/login")}
        >
          ← Vissza, új kód kérése
        </button>
      </div>
    </div>
  );
}
