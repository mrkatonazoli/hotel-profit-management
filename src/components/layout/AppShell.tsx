"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { HotelContext } from "@/lib/hotel-context";

interface AppShellProps {
  children: React.ReactNode;
  isSuperAdmin: boolean;
  hotelId: string;
  hotelName: string;
  userName?: string;
  userEmail?: string;
  allowedModules?: string[] | null;
}

export default function AppShell({
  children,
  isSuperAdmin,
  hotelId,
  hotelName,
  userName,
  userEmail,
  allowedModules,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on route change (mobile navigation)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <HotelContext.Provider value={hotelId}>
      <div className="flex h-screen overflow-hidden" style={{ background: "#F1F5F9" }}>
        <Sidebar
          isSuperAdmin={isSuperAdmin}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          allowedModules={allowedModules}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar
            hotelId={hotelId}
            hotelName={hotelName}
            userName={userName}
            userEmail={userEmail}
            onMenuOpen={() => setSidebarOpen(true)}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </HotelContext.Provider>
  );
}
