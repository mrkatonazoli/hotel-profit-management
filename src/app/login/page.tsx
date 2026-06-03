"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { HeyMaxLogo } from "@/components/HeyMaxLogo";

export default function LoginPage() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function getCallbackUrl() {
    if (typeof window === "undefined") return "/dashboard";
    return new URLSearchParams(window.location.search).get("callbackUrl") ?? "/dashboard";
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    const callbackUrl = getCallbackUrl();
    try {
      // 1. Ellenőrizzük, hogy létezik-e a felhasználó a rendszerben
      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const checkData = await checkRes.json();

      if (!checkData.exists) {
        setError("Önnek jelenleg nincs fiókja a rendszerben. Kérjük, vegye fel a kapcsolatot az adminisztrátorral.");
        setLoading(false);
        return;
      }

      // 2. Ha létezik, küldjük a belépési kódot
      const res = await signIn("nodemailer", { email, redirect: false, callbackUrl });
      if (res?.error) {
        setError("Hiba történt. Ellenőrizd az e-mail címet.");
      } else {
        setStep("code");
      }
    } catch {
      setError("Hiba történt. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError("");
    const callbackUrl = getCallbackUrl();
    try {
      // Redirect directly — the browser handles cookies and the full redirect chain
      window.location.href = `/api/auth/callback/nodemailer?token=${code}&email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
    } catch {
      setError("Hiba történt. Próbáld újra.");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#09203A", fontFamily: "'Schibsted Grotesk', system-ui, sans-serif" }}>

      {/* ── LEFT PANEL ── */}
      <div style={{ flex: 1.1, background: "#0F172A", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 56px", position: "relative", overflow: "hidden" }}>

        {/* Grid overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }} />

        {/* Violet glow top-right */}
        <div style={{ position: "absolute", top: -120, right: -120, width: 480, height: 480, background: "radial-gradient(circle, rgba(53,189,120,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        {/* Emerald glow bottom-left */}
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 360, height: 360, background: "radial-gradient(circle, rgba(21,50,81,0.4) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Brand */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <HeyMaxLogo size={20} onDark={true} iconVariant="full" />
        </div>

        {/* Headline */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", color: "#fff", marginBottom: 24 }}>
            Maximize your<br />
            <span style={{ background: "linear-gradient(135deg, #35BD78, #03915A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              hotel&apos;s profit.
            </span>
          </h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: "#64748B", lineHeight: 1.6, maxWidth: 380 }}>
            Plan. Forecast. Maximize. — Valós idejű bevételtervezés, pickup forecast és AI alapú stratégiai ajánlások, az Ön szállodájára szabva.
          </p>
        </div>

        {/* Floating cards area */}
        <div style={{ position: "relative", height: 200, zIndex: 1 }}>
          <FloatCard style={{ left: 0, top: 20, animationDelay: "0s", animationDuration: "5.5s" }}
            icon="📈" iconBg="rgba(53,189,120,0.25)" label="Kihasználtság"
            value="88%" trend="▲ +23%" trendColor="#10B981" />
          <FloatCard style={{ left: "40%", top: 0, animationDelay: "1.2s", animationDuration: "6.5s" }}
            icon="💰" iconBg="rgba(16,185,129,0.3)" label="Napi profit"
            value="+420 000 Ft" valueColor="#10B981" />
          <FloatCard style={{ left: "55%", top: 90, animationDelay: "0.6s", animationDuration: "5.8s" }}
            icon="🛏️" iconBg="rgba(245,158,11,0.3)" label="ADR"
            value="34 500 Ft" />
          <FloatCard style={{ left: "5%", top: 120, animationDelay: "2s", animationDuration: "7s" }}
            icon="🔮" iconBg="rgba(59,130,246,0.3)" label="Forecast"
            value="93%" trend="várható" trendColor="#94A3B8" />

          {/* SVG chart */}
          <svg viewBox="0 0 300 80" style={{ position: "absolute", bottom: 0, left: 0, right: 0, width: "100%", opacity: 0.18 }}>
            <path d="M0,70 C30,68 50,60 80,50 C110,40 130,35 160,25 C190,15 220,10 260,5 C275,3 290,4 300,4"
              fill="none" stroke="#35BD78" strokeWidth="2.5" strokeLinecap="round"
              style={{ strokeDasharray: 300, strokeDashoffset: 0 }} />
            <path d="M0,75 C30,73 50,68 80,62 C110,55 130,50 160,42 C190,34 220,28 260,20 C275,17 290,16 300,15"
              fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round"
              style={{ strokeDasharray: "6,3" }} />
          </svg>
        </div>

        {/* Testimonial */}
        <div style={{ position: "relative", zIndex: 1, borderLeft: "2px solid #35BD78", paddingLeft: 16 }}>
          <p style={{ fontSize: 13.5, color: "#94A3B8", lineHeight: 1.6, fontStyle: "italic", marginBottom: 10 }}>
            „Először látom tisztán, hogy melyik nap mikor válik profitábilissá — és mit kell tennem azért, hogy az legyen."
          </p>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
            Szállodaigazgató, Budapest · 40 szobás boutique hotel
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        width: 520, minWidth: 520, background: "#F8FAFC",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "56px 64px", position: "relative"
      }}>
        {/* Left border */}
        <div style={{ position: "absolute", top: 0, left: 0, width: 1, height: "100%", background: "linear-gradient(to bottom, transparent, #1E293B 20%, #1E293B 80%, transparent)" }} />

        <div style={{ width: "100%", maxWidth: 380 }}>
          {step === "email" ? (
            <form onSubmit={handleSendCode}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", marginBottom: 6, letterSpacing: "-0.02em" }}>
                Bejelentkezés
              </h2>
              <p style={{ fontSize: 14, color: "#64748B", marginBottom: 36 }}>
                Adja meg e-mail címét — küldünk egy belépési kódot.
              </p>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 7 }}>
                  E-mail cím
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nev@szalloda.hu"
                  style={{
                    width: "100%", padding: "13px 16px", border: "1.5px solid #E2E8F0",
                    borderRadius: 10, fontSize: 14, fontFamily: "inherit", color: "#0F172A",
                    background: "#fff", outline: "none", boxSizing: "border-box" as const,
                    transition: "border-color .15s, box-shadow .15s"
                  }}
                  onFocus={e => { e.target.style.borderColor = "#35BD78"; e.target.style.boxShadow = "0 0 0 3px rgba(53,189,120,0.15)"; }}
                  onBlur={e => { e.target.style.borderColor = "#E2E8F0"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              {error && <p style={{ fontSize: 13, color: "#EF4444", marginBottom: 12 }}>{error}</p>}

              <button type="submit" disabled={loading || !email} style={{
                width: "100%", padding: 14, background: "#35BD78", color: "#fff",
                border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700,
                fontFamily: "inherit", cursor: loading || !email ? "not-allowed" : "pointer",
                letterSpacing: "-0.01em", boxShadow: "0 4px 14px rgba(53,189,120,0.35)",
                opacity: loading || !email ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8
              }}>
                {loading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Küldés...</> : "Kód küldése →"}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 32, paddingTop: 24, borderTop: "1px solid #E2E8F0" }}>
                <div style={{ width: 6, height: 6, background: "#10B981", borderRadius: "50%", animation: "pulse 2s infinite" }} />
                <span style={{ fontSize: 11.5, color: "#94A3B8" }}>Jelszó nélkül · Biztonságos egyszeri kód</span>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>📬</div>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", marginBottom: 6, letterSpacing: "-0.02em" }}>
                Ellenőrizze postaládáját
              </h2>
              <p style={{ fontSize: 14, color: "#64748B", marginBottom: 36 }}>
                Elküldtük a belépési kódot ide: <strong>{email}</strong>
              </p>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 7 }}>
                  Biztonsági kód
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="_ _ _ _ _ _"
                  autoFocus
                  style={{
                    width: "100%", padding: "13px 16px", border: "1.5px solid #E2E8F0",
                    borderRadius: 10, fontSize: 22, fontWeight: 700, letterSpacing: "0.2em",
                    textAlign: "center" as const, fontFamily: "inherit", color: "#0F172A",
                    background: "#fff", outline: "none", boxSizing: "border-box" as const,
                    fontVariantNumeric: "tabular-nums"
                  }}
                  onFocus={e => { e.target.style.borderColor = "#35BD78"; e.target.style.boxShadow = "0 0 0 3px rgba(53,189,120,0.15)"; }}
                  onBlur={e => { e.target.style.borderColor = "#E2E8F0"; e.target.style.boxShadow = "none"; }}
                />
                <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 6, textAlign: "center" as const }}>A kód 10 percig érvényes</div>
              </div>

              {error && <p style={{ fontSize: 13, color: "#EF4444", marginBottom: 12, textAlign: "center" as const }}>{error}</p>}

              <button type="submit" disabled={loading || code.length !== 6} style={{
                width: "100%", padding: 14, background: "#35BD78", color: "#fff",
                border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700,
                fontFamily: "inherit", cursor: loading || code.length !== 6 ? "not-allowed" : "pointer",
                letterSpacing: "-0.01em", boxShadow: "0 4px 14px rgba(53,189,120,0.35)",
                opacity: loading || code.length !== 6 ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                marginTop: 8
              }}>
                {loading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Ellenőrzés...</> : "Belépés →"}
              </button>

              <div style={{ textAlign: "center" as const, marginTop: 20 }}>
                <span style={{ fontSize: 12.5, color: "#64748B" }}>Nem érkezett meg? </span>
                <button type="button" onClick={() => { setStep("email"); setCode(""); setError(""); }}
                  style={{ fontSize: 12.5, color: "#35BD78", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  Új kód kérése
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 32, paddingTop: 24, borderTop: "1px solid #E2E8F0" }}>
                <div style={{ width: 6, height: 6, background: "#10B981", borderRadius: "50%", animation: "pulse 2s infinite" }} />
                <span style={{ fontSize: 11.5, color: "#94A3B8" }}>Biztonságos kapcsolat · Adatok titkosítva tárolva</span>
              </div>
            </form>
          )}
        </div>

        <div style={{ position: "absolute", bottom: 24, right: 24, fontSize: 11, color: "#CBD5E1" }}>v0.1 MVP</div>
      </div>

      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0px);   opacity: 0.7; }
          50%  { transform: translateY(-10px); opacity: 1;   }
          100% { transform: translateY(0px);   opacity: 0.7; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function FloatCard({ icon, iconBg, label, value, valueColor, trend, trendColor, style }: {
  icon: string; iconBg: string; label: string; value: string;
  valueColor?: string; trend?: string; trendColor?: string;
  style: React.CSSProperties;
}) {
  return (
    <div style={{
      position: "absolute",
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.1)",
      backdropFilter: "blur(8px)",
      borderRadius: 12,
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      animation: "floatUp 6s ease-in-out infinite",
      ...style
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: valueColor ?? "#fff", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
          {value}{trend && <span style={{ fontSize: 11, fontWeight: 600, color: trendColor, marginLeft: 4 }}>{trend}</span>}
        </div>
      </div>
    </div>
  );
}
