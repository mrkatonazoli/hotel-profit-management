"use client";

import { BarChart3, Mail, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function NoHotelPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0F172A" }}>
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #35BD78, #3B82F6, #10B981)" }} />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "linear-gradient(135deg, #35BD78, #03915A)", boxShadow: "0 8px 32px rgba(53,189,120,0.4)" }}>
          <BarChart3 size={24} color="white" />
        </div>

        <div className="w-full max-w-md rounded-2xl overflow-hidden text-center"
          style={{ background: "#1E293B", border: "1px solid #334155" }}>
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #35BD78, #03915A)" }} />
          <div className="p-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "#0F172A" }}>
              <Mail size={28} style={{ color: "#64748B" }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "#F8FAFC" }}>
              Nincs hozzárendelt szálloda
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: "#64748B" }}>
              Még nem vagy hozzárendelve egyetlen szállodához sem.<br />
              Kérj meghívót a szálloda kezelőjétől, majd kattints a kapott linkre.
            </p>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2 mx-auto text-sm font-semibold px-5 py-2.5 rounded-xl"
              style={{ background: "#1E293B", border: "1px solid #334155", color: "#64748B", cursor: "pointer" }}>
              <LogOut size={15} />
              Kijelentkezés
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
