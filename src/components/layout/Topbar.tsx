"use client";

import { signOut } from "next-auth/react";
import { LogOut, Bell, ChevronDown } from "lucide-react";

interface TopbarProps {
  hotelName?: string;
  userName?: string;
  userEmail?: string;
}

export default function Topbar({ hotelName = "Hotel", userName, userEmail }: TopbarProps) {
  return (
    <header
      className="h-14 flex items-center justify-between px-6 flex-shrink-0"
      style={{
        background: "#0F172A",
        borderBottom: "1px solid #1E293B",
      }}
    >
      {/* Hotel selector */}
      <button
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        style={{ color: "#94A3B8", background: "#1E293B" }}
      >
        <span style={{ color: "#F8FAFC" }}>{hotelName}</span>
        <ChevronDown size={14} />
      </button>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: "#64748B" }}
        >
          <Bell size={16} />
        </button>

        <div
          className="flex items-center gap-2 pl-3"
          style={{ borderLeft: "1px solid #1E293B" }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: "#7C3AED", color: "white" }}
          >
            {(userName ?? userEmail ?? "?")[0].toUpperCase()}
          </div>
          <span className="text-sm hidden sm:block" style={{ color: "#94A3B8" }}>
            {userName ?? userEmail}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors ml-1"
            style={{ color: "#64748B" }}
            title="Kijelentkezés"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
