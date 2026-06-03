"use client";

import { useState } from "react";
import { Building2, Loader2, CheckCircle2, Send } from "lucide-react";

export default function RequestHotelPage() {
  const [hotelName, setHotelName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hotelName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/request-hotel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelName: hotelName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Hiba történt. Próbálja újra.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Hiba történt. Ellenőrizze az internetkapcsolatát.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100%",
      background: "#F1F5F9",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "48px 24px",
    }}>
      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: "linear-gradient(135deg, #153251, #09203A)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20,
            boxShadow: "0 4px 16px rgba(21,50,81,0.25)",
          }}>
            <Building2 size={24} color="#35BD78" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
            Új szálloda felvétele
          </h1>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0, lineHeight: 1.6 }}>
            Küldjön igényt az adminisztrátornak, hogy vegyen fel egy új szállodát a rendszerbe.
          </p>
        </div>

        {success ? (
          /* ── Sikeres beküldés ── */
          <div style={{
            background: "#fff",
            borderRadius: 16,
            padding: "40px 36px",
            textAlign: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            border: "1px solid #E2E8F0",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "rgba(53,189,120,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <CheckCircle2 size={32} color="#35BD78" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: "0 0 10px" }}>
              Igény sikeresen elküldve!
            </h2>
            <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 8px", lineHeight: 1.6 }}>
              Az adminisztrátor hamarosan felveszi a szállodát,<br />
              és értesítjük, amint hozzáférést kap.
            </p>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>
              Kért szálloda: <strong style={{ color: "#334155" }}>{hotelName}</strong>
            </p>

            <button
              onClick={() => { setSuccess(false); setHotelName(""); }}
              style={{
                marginTop: 28, padding: "10px 24px",
                background: "transparent", border: "1.5px solid #E2E8F0",
                borderRadius: 10, fontSize: 13, fontWeight: 600,
                color: "#64748B", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Új igény beküldése
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <form
            onSubmit={handleSubmit}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "36px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              border: "1px solid #E2E8F0",
            }}
          >
            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: "block",
                fontSize: 12, fontWeight: 700,
                color: "#334155",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}>
                Szálloda neve
              </label>
              <input
                type="text"
                required
                autoFocus
                value={hotelName}
                onChange={e => setHotelName(e.target.value)}
                placeholder="pl. Hotel Pannónia Budapest"
                style={{
                  width: "100%", padding: "13px 16px",
                  border: "1.5px solid #E2E8F0",
                  borderRadius: 10, fontSize: 15,
                  fontFamily: "inherit", color: "#0F172A",
                  background: "#fff", outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color .15s, box-shadow .15s",
                }}
                onFocus={e => {
                  e.target.style.borderColor = "#35BD78";
                  e.target.style.boxShadow = "0 0 0 3px rgba(53,189,120,0.15)";
                }}
                onBlur={e => {
                  e.target.style.borderColor = "#E2E8F0";
                  e.target.style.boxShadow = "none";
                }}
              />
              <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 6, marginBottom: 0 }}>
                Adja meg a szálloda teljes nevét, ahogy a rendszerben szerepelni szeretné.
              </p>
            </div>

            {error && (
              <p style={{ fontSize: 13, color: "#EF4444", marginBottom: 16, padding: "10px 14px", background: "#FEF2F2", borderRadius: 8, border: "1px solid #FECACA" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !hotelName.trim()}
              style={{
                width: "100%", padding: "14px",
                background: loading || !hotelName.trim() ? "#CBD5E1" : "#35BD78",
                color: "#fff", border: "none", borderRadius: 10,
                fontSize: 15, fontWeight: 700,
                fontFamily: "inherit",
                cursor: loading || !hotelName.trim() ? "not-allowed" : "pointer",
                letterSpacing: "-0.01em",
                boxShadow: loading || !hotelName.trim() ? "none" : "0 4px 14px rgba(53,189,120,0.35)",
                transition: "all .15s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {loading
                ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Küldés...</>
                : <><Send size={15} /> Igény beküldése</>
              }
            </button>
          </form>
        )}

        {/* Info box */}
        {!success && (
          <div style={{
            marginTop: 16,
            padding: "14px 18px",
            background: "rgba(21,50,81,0.06)",
            borderRadius: 12,
            border: "1px solid rgba(21,50,81,0.1)",
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
            <p style={{ fontSize: 12.5, color: "#475569", margin: 0, lineHeight: 1.6 }}>
              Az igény beküldése után az adminisztrátor e-mailben értesül. A szálloda felvétele után Ön hozzáférést kap az adott szálloda adataihoz.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
