"use client";

import { signOut } from "next-auth/react";
import { LogOut, Bell, Menu } from "lucide-react";
import HotelSwitcher from "./HotelSwitcher";

interface TopbarProps {
  hotelId?: string;
  hotelName?: string;
  userName?: string;
  userEmail?: string;
  onMenuOpen?: () => void;
}

export default function Topbar({
  hotelId = "",
  hotelName = "Hotel",
  userName,
  userEmail,
  onMenuOpen,
}: TopbarProps) {
  return (
    <header
      className="h-14 flex items-center justify-between px-4 md:px-6 flex-shrink-0"
      style={{
        background: "#0F172A",
        borderBottom: "1px solid #1E293B",
      }}
    >
      {/* Left: hamburger (mobile) + hotel switcher */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Hamburger — only on mobile */}
        <button
          onClick={onMenuOpen}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-colors flex-shrink-0"
          style={{ color: "#94A3B8" }}
          aria-label="Navigáció megnyitása"
        >
          <Menu size={20} />
        </button>

        <HotelSwitcher currentHotelId={hotelId} currentHotelName={hotelName} />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: "#64748B" }}
          aria-label="Értesítések"
        >
          <Bell size={16} />
        </button>

        <div
          className="flex items-center gap-2 pl-2 md:pl-3"
          style={{ borderLeft: "1px solid #1E293B" }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: "#7C3AED", color: "white" }}
          >
            {(userName ?? userEmail ?? "?")[0].toUpperCase()}
          </div>
          <span className="text-sm hidden lg:block truncate max-w-[140px]" style={{ color: "#94A3B8" }}>
            {userName ?? userEmail}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors ml-1"
            style={{ color: "#64748B" }}
            title="Kijelentkezés"
            aria-label="Kijelentkezés"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
