"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { Building2, Check, Loader2, ShieldAlert, BarChart3 } from "lucide-react";

type InviteInfo = {
  email: string;
  role: "MANAGER" | "VIEWER";
  hotel: { id: string; name: string; city: string };
  expiresAt: string;
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setLoadErr(data.error);
        else setInvite(data);
      })
      .catch(() => setLoadErr("Hiba a meghívó betöltésekor"));
  }, [token]);

  async function acceptInvite() {
    setAccepting(true);
    try {
      const res = await fetch(`/api/invites/${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setLoadErr(data.error); return; }
      // Set hotel cookie
      await fetch("/api/hotels/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId: data.hotelId }),
      });
      setAccepted(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    } finally {
      setAccepting(false);
    }
  }

  const ROLE_LABEL = { MANAGER: "Manager", VIEWER: "Viewer" };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0F172A" }}>
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #7C3AED, #3B82F6, #10B981)" }} />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)", boxShadow: "0 8px 32px rgba(124,58,237,0.4)" }}>
            <BarChart3 size={24} color="white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#F8FAFC" }}>Hotel Profit</h1>
        </div>

        {/* Card */}
        <div className="w-full max-w-md rounded-2xl overflow-hidden"
          style={{ background: "#1E293B", border: "1px solid #334155" }}>
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #7C3AED, #5B21B6)" }} />

          <div className="p-8">
            {/* Loading invite */}
            {!invite && !loadErr && (
              <div className="flex items-center justify-center gap-3 py-6" style={{ color: "#64748B" }}>
                <Loader2 size={20} className="animate-spin" />
                Meghívó betöltése…
              </div>
            )}

            {/* Error */}
            {loadErr && (
              <div className="text-center py-4">
                <ShieldAlert size={40} className="mx-auto mb-3" style={{ color: "#EF4444" }} />
                <p className="font-semibold" style={{ color: "#F8FAFC" }}>{loadErr}</p>
                <p className="text-sm mt-2" style={{ color: "#64748B" }}>
                  Kérj új meghívót a csapatvezérektől.
                </p>
              </div>
            )}

            {/* Accepted */}
            {accepted && (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}>
                  <Check size={28} color="white" />
                </div>
                <p className="text-xl font-bold mb-2" style={{ color: "#F8FAFC" }}>Csatlakozás sikeres!</p>
                <p className="text-sm" style={{ color: "#64748B" }}>Átirányítás a dashboardra…</p>
              </div>
            )}

            {/* Invite info */}
            {invite && !accepted && (
              <div>
                <h2 className="text-xl font-bold mb-1" style={{ color: "#F8FAFC" }}>Csapati meghívó</h2>
                <p className="text-sm mb-6" style={{ color: "#64748B" }}>
                  Meghívtak a következő szálloda csapatába:
                </p>

                {/* Hotel card */}
                <div className="rounded-xl p-4 mb-6 flex items-center gap-4"
                  style={{ background: "#0F172A", border: "1px solid #334155" }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#1E293B" }}>
                    <Building2 size={22} style={{ color: "#7C3AED" }} />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: "#F8FAFC" }}>{invite.hotel.name}</p>
                    <p className="text-sm" style={{ color: "#64748B" }}>{invite.hotel.city}</p>
                  </div>
                  <div className="ml-auto px-3 py-1 rounded-lg text-xs font-bold"
                    style={{ background: "#2D1F6E", color: "#A78BFA" }}>
                    {ROLE_LABEL[invite.role]}
                  </div>
                </div>

                {/* Auth state */}
                {status === "loading" ? (
                  <div className="flex items-center justify-center gap-2 py-4" style={{ color: "#64748B" }}>
                    <Loader2 size={16} className="animate-spin" /> Betöltés…
                  </div>
                ) : !session ? (
                  <div className="text-center">
                    <p className="text-sm mb-4" style={{ color: "#94A3B8" }}>
                      A meghívó elfogadásához be kell jelentkezned a(z){" "}
                      <strong style={{ color: "#A78BFA" }}>{invite.email}</strong> fiókkal.
                    </p>
                    <button
                      onClick={() => signIn(undefined, { callbackUrl: `/invite/${token}` })}
                      className="w-full py-3 rounded-xl font-bold text-sm"
                      style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)", color: "white", border: "none", cursor: "pointer" }}>
                      Bejelentkezés / Regisztráció
                    </button>
                  </div>
                ) : session.user?.email?.toLowerCase() !== invite.email.toLowerCase() ? (
                  <div className="rounded-xl p-4 text-sm" style={{ background: "#450A0A", color: "#FCA5A5", border: "1px solid #7F1D1D" }}>
                    <strong>Figyelem:</strong> Jelenleg <strong>{session.user?.email}</strong> fiókkal vagy belépve,
                    de ez a meghívó a <strong>{invite.email}</strong> címre szól.
                    Jelentkezz ki és a megfelelő fiókkal lépj be.
                  </div>
                ) : (
                  <button
                    onClick={acceptInvite}
                    disabled={accepting}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)", color: "white", border: "none", cursor: "pointer" }}>
                    {accepting
                      ? <><Loader2 size={16} className="animate-spin" /> Csatlakozás…</>
                      : <><Check size={16} /> Meghívó elfogadása</>
                    }
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
