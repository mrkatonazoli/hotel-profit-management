import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true, name: true },
  });

  if (user?.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F1F5F9" }}>
      <Sidebar isSuperAdmin={true} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          hotelName="Hotel"
          userName={session.user?.name ?? undefined}
          userEmail={session.user?.email ?? undefined}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
