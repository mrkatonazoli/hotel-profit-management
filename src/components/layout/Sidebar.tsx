"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TrendingUp,
  LayoutDashboard,
  Calendar,
  GitBranch,
  DollarSign,
  Users,
  BarChart2,
  Settings,
  Building2,
  Upload,
  Scale,
  ShieldCheck,
  Search,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/revenue-planner", icon: Calendar, label: "Bevételtervező" },
  { href: "/scenarios", icon: GitBranch, label: "Szcenáriók" },
  { href: "/weighting", icon: Scale, label: "Súlyozás" },
  { href: "/costs", icon: DollarSign, label: "Kiadások" },
  { href: "/reporting", icon: BarChart2, label: "Riportok" },
  { href: "/analysis", icon: Search, label: "Részletes elemzés" },
  { href: "/historical-import", icon: Upload, label: "Pickup import" },
];

const bottomItems = [
  { href: "/hotel-config", icon: Building2, label: "Hotel beállítások" },
  { href: "/team", icon: Users, label: "Csapat" },
  { href: "/settings", icon: Settings, label: "Beállítások" },
];

export default function Sidebar({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col h-screen sticky top-0"
      style={{ background: "#0F172A", borderRight: "1px solid #1E293B" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: "1px solid #1E293B" }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "#7C3AED" }}
        >
          <TrendingUp size={16} color="white" />
        </div>
        <span className="font-bold text-base" style={{ color: "#F8FAFC" }}>
          Hotel Profit
        </span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                color: active ? "#F8FAFC" : "#64748B",
                background: active ? "#1E293B" : "transparent",
                borderLeft: active ? "3px solid #7C3AED" : "3px solid transparent",
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="px-3 py-4 space-y-0.5" style={{ borderTop: "1px solid #1E293B" }}>
        {bottomItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                color: active ? "#F8FAFC" : "#64748B",
                background: active ? "#1E293B" : "transparent",
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}

        {/* Super admin only */}
        {isSuperAdmin && (
          <>
            <div className="mx-3 my-2" style={{ borderTop: "1px solid #1E293B" }} />
            <Link
              href="/admin/token-stats"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                color: pathname.startsWith("/admin") ? "#A78BFA" : "#475569",
                background: pathname.startsWith("/admin") ? "#1E1030" : "transparent",
                borderLeft: pathname.startsWith("/admin") ? "3px solid #7C3AED" : "3px solid transparent",
              }}
            >
              <ShieldCheck size={16} />
              AI Token stats
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
