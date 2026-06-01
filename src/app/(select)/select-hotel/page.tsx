"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, BedDouble, BarChart3, ChevronRight, Loader2, Star, MapPin } from "lucide-react";

type HotelOption = {
  id: string;
  name: string;
  city: string;
  country: string;
  baseCurrency: string;
  totalRooms: number | null;
  role?: string;
  scenarioCount?: number;
};

export default function SelectHotelPage() {
  const [hotels, setHotels] = useState<HotelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const router = useRouter();
  const { data: session } = useSession();
  const userName = session?.user?.name ?? session?.user?.email ?? "";
  const hour = new Date().getHours();
  const greeting = hour < 10 ? "Jó reggelt" : hour < 18 ? "Szia" : "Jó estét";

  useEffect(() => {
    fetch("/api/hotels/list")
      .then(r => r.json())
      .then(setHotels)
      .finally(() => setLoading(false));
  }, []);

  async function selectHotel(hotelId: string) {
    setSelecting(hotelId);
    await fetch("/api/hotels/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId }),
    });
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0F172A" }}>

      {/* Top gradient bar */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #35BD78, #3B82F6, #10B981)" }} />

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">

        {/* Logo / brand */}
        <div className="mb-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "linear-gradient(135deg, #35BD78, #03915A)", boxShadow: "0 8px 32px rgba(53,189,120,0.4)" }}>
            <BarChart3 size={28} color="white" />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#F8FAFC" }}>
            {greeting}{userName ? `, ${userName}` : ""}! 👋
          </h1>
          <p className="text-base" style={{ color: "#64748B" }}>
            Válaszd ki, melyik szállodával szeretnél dolgozni ma
          </p>
        </div>

        {/* Hotel grid */}
        {loading ? (
          <div className="flex items-center gap-3" style={{ color: "#64748B" }}>
            <Loader2 size={20} className="animate-spin" />
            <span>Szállodák betöltése…</span>
          </div>
        ) : hotels.length === 0 ? (
          <div className="text-center" style={{ color: "#64748B" }}>
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p>Nincs hozzárendelt szállodád</p>
          </div>
        ) : (
          <div className={`w-full max-w-4xl grid gap-4 ${hotels.length === 1 ? "max-w-sm" : hotels.length === 2 ? "grid-cols-2 max-w-2xl" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
            {hotels.map((hotel, i) => {
              const isSelecting = selecting === hotel.id;
              const isDisabled  = selecting !== null && !isSelecting;
              return (
                <button
                  key={hotel.id}
                  onClick={() => selectHotel(hotel.id)}
                  disabled={selecting !== null}
                  className="group relative text-left rounded-2xl transition-all duration-200 overflow-hidden"
                  style={{
                    background: "#1E293B",
                    border: "1px solid #334155",
                    opacity: isDisabled ? 0.5 : 1,
                    transform: isSelecting ? "scale(0.98)" : undefined,
                    boxShadow: isSelecting ? "0 0 0 2px #35BD78" : undefined,
                  }}
                >
                  {/* Top color stripe per hotel */}
                  <div className="h-1 w-full" style={{
                    background: [
                      "linear-gradient(90deg, #35BD78, #03915A)",
                      "linear-gradient(90deg, #3B82F6, #1D4ED8)",
                      "linear-gradient(90deg, #10B981, #059669)",
                      "linear-gradient(90deg, #F59E0B, #D97706)",
                      "linear-gradient(90deg, #EC4899, #BE185D)",
                    ][i % 5]
                  }} />

                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: "#0F172A" }}>
                        {isSelecting
                          ? <Loader2 size={20} className="animate-spin" style={{ color: "#35BD78" }} />
                          : <Building2 size={20} style={{ color: "#35BD78" }} />
                        }
                      </div>
                      {hotel.role === "MANAGER" && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
                          style={{ background: "#2D1F6E", color: "#90DBAC" }}>
                          <Star size={10} />
                          Kezelő
                        </div>
                      )}
                    </div>

                    {/* Name & location */}
                    <h2 className="text-lg font-bold mb-1 leading-tight" style={{ color: "#F8FAFC" }}>
                      {hotel.name}
                    </h2>
                    <div className="flex items-center gap-1.5 mb-5">
                      <MapPin size={12} style={{ color: "#475569" }} />
                      <span className="text-sm" style={{ color: "#475569" }}>
                        {hotel.city}{hotel.country && hotel.country !== "HU" ? `, ${hotel.country}` : ""}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="rounded-xl p-3" style={{ background: "#0F172A" }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <BedDouble size={12} style={{ color: "#64748B" }} />
                          <span className="text-xs" style={{ color: "#64748B" }}>Szobák</span>
                        </div>
                        <div className="text-xl font-bold" style={{ color: "#F8FAFC" }}>
                          {hotel.totalRooms ?? "—"}
                        </div>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "#0F172A" }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs" style={{ color: "#64748B" }}>Deviza</span>
                        </div>
                        <div className="text-xl font-bold" style={{ color: "#F8FAFC" }}>
                          {hotel.baseCurrency}
                        </div>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold" style={{ color: isSelecting ? "#35BD78" : "#64748B" }}>
                        {isSelecting ? "Belépés…" : "Megnyitás"}
                      </span>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                        style={{
                          background: "#334155",
                          transform: "translateX(0)",
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#35BD78"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#334155"}
                      >
                        <ChevronRight size={16} style={{ color: "#94A3B8" }} />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        {hotels.length > 1 && (
          <p className="mt-10 text-xs text-center" style={{ color: "#334155" }}>
            Belépés után a szállodák között a fejlécben tudsz váltani
          </p>
        )}
      </div>
    </div>
  );
}
