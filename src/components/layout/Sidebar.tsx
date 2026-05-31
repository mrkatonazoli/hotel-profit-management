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
  X,
  Zap,
  SlidersHorizontal,
  BookOpen,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",         icon: LayoutDashboard, label: "Dashboard",          module: null },
  { href: "/revenue-planner",   icon: Calendar,        label: "Bevételtervező",     module: "REVENUE_PLANNER" },
  { href: "/scenarios",         icon: GitBranch,       label: "Szcenáriók",         module: "SCENARIOS" },
  { href: "/weighting",         icon: Scale,           label: "Súlyozás",           module: "WEIGHTING" },
  { href: "/costs",             icon: DollarSign,      label: "Kiadások",           module: "COSTS" },
  { href: "/reporting",         icon: BarChart2,       label: "Riportok",           module: "REPORTING" },
  { href: "/analysis",          icon: Search,          label: "Részletes elemzés",  module: "ANALYSIS" },
  { href: "/historical-import", icon: Upload,          label: "Pickup import",      module: "HISTORICAL_IMPORT" },
];

const bottomItems = [
  { href: "/hotel-config", icon: Building2, label: "Hotel beállítások", module: "HOTEL_CONFIG" },
  { href: "/team",         icon: Users,     label: "Csapat",            module: "TEAM" },
  { href: "/settings",     icon: Settings,  label: "Beállítások",       module: null },
];

interface SidebarProps {
  isSuperAdmin?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  allowedModules?: string[] | null;
}

export default function Sidebar({ isSuperAdmin = false, isOpen = false, onClose, allowedModules }: SidebarProps) {
  const pathname = usePathname();

  function isModuleAllowed(module: string | null): boolean {
    if (allowedModules === null || allowedModules === undefined) return true;
    if (module === null) return true;
    return allowedModules.includes(module);
  }

  const sidebarContent = (
    <aside
      className="w-60 flex-shrink-0 flex flex-col h-full"
      style={{ background: "#0F172A", borderRight: "1px solid #1E293B" }}
    >
      {/* Logo + close button (mobile) */}
      <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: "1px solid #1E293B" }}>
        <div className="flex items-center gap-3">
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
        {/* Close button — only visible on mobile */}
        <button
          onClick={onClose}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: "#64748B" }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.filter(item => isModuleAllowed(item.module)).map(({ href, icon: Icon, label }) => {
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

        {/* ── Simple Planner — kiemelt menüpont ── */}
        {isModuleAllowed("SIMPLE_PLANNER") && <div style={{ paddingTop: 10, paddingBottom: 2 }}>
          <div style={{ height: 1, background: "#1E293B", marginBottom: 10 }} />
          {(() => {
            const active = pathname === "/simple-planner" || pathname.startsWith("/simple-planner/");
            return (
              <Link
                href="/simple-planner"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative overflow-hidden"
                style={{
                  background: active
                    ? "linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)"
                    : "linear-gradient(135deg, #1E1B4B 0%, #1E293B 100%)",
                  color: active ? "#F5F3FF" : "#A78BFA",
                  border: `1px solid ${active ? "#7C3AED" : "#312E81"}`,
                  boxShadow: active ? "0 0 16px #7C3AED44" : "none",
                }}
              >
                {/* Fényes shimmer effekt */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.05) 50%, transparent 60%)",
                  pointerEvents: "none",
                }} />
                <div style={{
                  width: 22, height: 22, borderRadius: 7,
                  background: active ? "rgba(255,255,255,0.2)" : "#312E81",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Zap size={13} color={active ? "white" : "#A78BFA"} fill={active ? "white" : "none"} />
                </div>
                <span style={{ flex: 1 }}>Simple Planner</span>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: "0.06em",
                  background: active ? "rgba(255,255,255,0.25)" : "#312E81",
                  color: active ? "white" : "#A78BFA",
                  padding: "2px 6px", borderRadius: 5,
                  textTransform: "uppercase",
                }}>
                  BETA
                </span>
              </Link>
            );
          })()}

          {/* Simple Planner — almenük */}
          {(() => {
            const inSimplePlanner = pathname === "/simple-planner" || pathname.startsWith("/simple-planner/");
            if (!inSimplePlanner) return null;
            const activeSettings = pathname === "/simple-planner/settings";
            const activeManual   = pathname === "/simple-planner/manual";
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 3 }}>
                <Link
                  href="/simple-planner/settings"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    marginLeft: 10,
                    color: activeSettings ? "#A78BFA" : "#475569",
                    background: activeSettings ? "#1E1B4B" : "transparent",
                    fontSize: 12,
                  }}
                >
                  <SlidersHorizontal size={13} color={activeSettings ? "#A78BFA" : "#475569"} />
                  Beállítások
                </Link>
                <Link
                  href="/simple-planner/manual"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    marginLeft: 10,
                    color: activeManual ? "#A78BFA" : "#475569",
                    background: activeManual ? "#1E1B4B" : "transparent",
                    fontSize: 12,
                  }}
                >
                  <BookOpen size={13} color={activeManual ? "#A78BFA" : "#475569"} />
                  Kézikönyv
                </Link>
              </div>
            );
          })()}
        </div>}
      </nav>

      {/* Bottom nav */}
      <div className="px-3 py-4 space-y-0.5" style={{ borderTop: "1px solid #1E293B" }}>
        {bottomItems.filter(item => isModuleAllowed(item.module)).map(({ href, icon: Icon, label }) => {
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
              href="/admin/hotels"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                color: pathname === "/admin/hotels" ? "#A78BFA" : "#475569",
                background: pathname === "/admin/hotels" ? "#1E1030" : "transparent",
                borderLeft: pathname === "/admin/hotels" ? "3px solid #7C3AED" : "3px solid transparent",
              }}
            >
              <ShieldCheck size={16} />
              Szállodák
            </Link>
            <Link
              href="/admin/token-stats"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                color: pathname === "/admin/token-stats" ? "#A78BFA" : "#475569",
                background: pathname === "/admin/token-stats" ? "#1E1030" : "transparent",
                borderLeft: pathname === "/admin/token-stats" ? "3px solid #7C3AED" : "3px solid transparent",
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

  return (
    <>
      {/* ── Desktop sidebar — always visible ── */}
      <div className="hidden md:flex h-screen sticky top-0 flex-shrink-0">
        {sidebarContent}
      </div>

      {/* ── Mobile sidebar — overlay drawer ── */}
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
          onClick={onClose}
        />
      )}
      {/* Drawer */}
      <div
        className="fixed inset-y-0 left-0 z-50 md:hidden flex-shrink-0 transition-transform duration-300 ease-in-out"
        style={{
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {sidebarContent}
      </div>
    </>
  );
}
