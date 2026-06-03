"use client";

import { useEffect, useState } from "react";
import { Settings, Mail, Save, Loader2, CheckCircle2 } from "lucide-react";

export default function AdminSettingsPage() {
  const [notifEmail, setNotifEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(data => {
        setNotifEmail(data.admin_notification_email ?? "");
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "admin_notification_email", value: notifEmail.trim() }),
      });
      if (!res.ok) throw new Error("Hiba a mentés során.");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Rendszerbeállítások
        </h1>
        <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>⚡ God Mode — globális konfigurációk</p>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <Loader2 size={22} color="#35BD78" style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <form onSubmit={handleSave}>

          {/* Section: Értesítések */}
          <div style={{
            background: "white", borderRadius: 16, border: "1px solid #E2E8F0",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden", marginBottom: 16,
          }}>
            {/* Section header */}
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid #F1F5F9",
              display: "flex", alignItems: "center", gap: 10,
              background: "linear-gradient(135deg, #F8FAFC, #F1F5F9)",
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: "rgba(53,189,120,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Mail size={16} color="#35BD78" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Értesítési e-mail</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>Ide érkeznek az új szálloda igények</div>
              </div>
            </div>

            {/* Field */}
            <div style={{ padding: "20px" }}>
              <label style={{
                display: "block", fontSize: 11, fontWeight: 700,
                color: "#334155", textTransform: "uppercase",
                letterSpacing: "0.06em", marginBottom: 8,
              }}>
                E-mail cím
              </label>
              <input
                type="email"
                value={notifEmail}
                onChange={e => setNotifEmail(e.target.value)}
                placeholder="pl. admin@heymax.app"
                style={{
                  width: "100%", padding: "11px 14px",
                  border: "1.5px solid #E2E8F0", borderRadius: 10,
                  fontSize: 14, fontFamily: "inherit", color: "#0F172A",
                  background: "#fff", outline: "none", boxSizing: "border-box",
                  transition: "border-color .15s, box-shadow .15s",
                }}
                onFocus={e => { e.target.style.borderColor = "#35BD78"; e.target.style.boxShadow = "0 0 0 3px rgba(53,189,120,0.12)"; }}
                onBlur={e => { e.target.style.borderColor = "#E2E8F0"; e.target.style.boxShadow = "none"; }}
              />
              <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 6, marginBottom: 0 }}>
                Ha üres, a rendszer az <code style={{ background: "#F1F5F9", padding: "1px 5px", borderRadius: 4 }}>ADMIN_EMAIL</code> env változót használja.
              </p>
            </div>
          </div>

          {error && (
            <p style={{ fontSize: 13, color: "#EF4444", marginBottom: 12, padding: "10px 14px", background: "#FEF2F2", borderRadius: 8, border: "1px solid #FECACA" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "11px 24px",
              background: saved ? "#10B981" : "#35BD78",
              color: "white", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: saving ? 0.7 : 1,
              boxShadow: "0 4px 14px rgba(53,189,120,0.3)",
              transition: "background .2s",
            }}
          >
            {saving
              ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Mentés...</>
              : saved
              ? <><CheckCircle2 size={15} /> Elmentve!</>
              : <><Save size={15} /> Beállítások mentése</>
            }
          </button>
        </form>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
