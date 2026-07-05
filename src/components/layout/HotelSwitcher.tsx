"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Building2, Check, Loader2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

type HotelOption = {
  id: string;
  name: string;
  baseCurrency: string;
  totalRooms: number | null;
  role?: string;
};

export default function HotelSwitcher({ currentHotelId, currentHotelName }: {
  currentHotelId: string;
  currentHotelName: string;
}) {
  const [open, setOpen] = useState(false);
  const [hotels, setHotels] = useState<HotelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function fetchHotels() {
    if (hotels.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/hotels/list");
      if (res.ok) setHotels(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function selectHotel(hotelId: string) {
    if (hotelId === currentHotelId) { setOpen(false); return; }
    setSwitching(true);
    await fetch("/api/hotels/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId }),
    });
    setOpen(false);
    setSwitching(false);
    // 1. Értesítjük a kliensoldali lapokat hogy töltsenek újra adatot
    window.dispatchEvent(new CustomEvent("hotel-changed", { detail: { hotelId } }));
    // 2. Frissítjük a server componenteket (layout header, hotel név)
    router.refresh();
    // 3. Ha részoldalon vagyunk (pl. /simple-planner/[id]), navigáljunk a szekció gyökerére
    const sectionRoots = [
      "/simple-planner", "/revenue-planner", "/scenarios",
      "/weighting", "/costs", "/reporting", "/analysis",
      "/historical-import", "/hotel-config", "/team",
    ];
    const matchedRoot = sectionRoots.find(root => pathname.startsWith(root + "/"));
    if (matchedRoot) router.push(matchedRoot);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); fetchHotels(); }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors max-w-[180px] sm:max-w-none"
        style={{ color: "#94A3B8", background: "#1E293B" }}
      >
        <Building2 size={14} style={{ color: "#35BD78", flexShrink: 0 }} />
        <span className="truncate" style={{ color: "#F8FAFC" }}>{currentHotelName}</span>
        {switching
          ? <Loader2 size={13} className="animate-spin" style={{ color: "#35BD78" }} />
          : <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
        }
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 rounded-xl overflow-hidden z-50"
          style={{
            minWidth: 240,
            background: "#1E293B",
            border: "1px solid #334155",
            boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
          }}
        >
          {/* Header */}
          <div className="px-4 py-3" style={{ borderBottom: "1px solid #334155" }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#64748B" }}>
              Szálloda választó
            </p>
          </div>

          {/* List */}
          <div className="py-1.5 max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={16} className="animate-spin" style={{ color: "#35BD78" }} />
              </div>
            ) : hotels.length === 0 ? (
              <div className="px-4 py-4 text-xs text-center" style={{ color: "#64748B" }}>
                Nincs elérhető szálloda
              </div>
            ) : hotels.map(h => {
              const active = h.id === currentHotelId;
              return (
                <button
                  key={h.id}
                  onClick={() => selectHotel(h.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{
                    background: active ? "#2D3F55" : "transparent",
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#263347"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: active ? "#35BD78" : "#334155" }}>
                    <Building2 size={14} style={{ color: active ? "white" : "#94A3B8" }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: active ? "#F8FAFC" : "#CBD5E1" }}>
                      {h.name}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                      {h.totalRooms ? `${h.totalRooms} szoba` : "—"}
                      {h.role && <span className="ml-2 capitalize">{h.role === "MANAGER" ? "· Kezelő" : "· Olvasó"}</span>}
                    </div>
                  </div>

                  {/* Active check */}
                  {active && <Check size={14} style={{ color: "#35BD78", flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5" style={{ borderTop: "1px solid #334155" }}>
            <p className="text-xs" style={{ color: "#475569" }}>
              {hotels.length} szálloda érhető el
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
