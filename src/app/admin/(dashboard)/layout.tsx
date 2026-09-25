import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/adminAuth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  const userLabel = session?.user?.name ?? session?.user?.email ?? "Admin";

  return (
    <div className="flex h-screen overflow-hidden bg-brand-soft">
      <AdminSidebar userLabel={userLabel} />

      <main className="flex min-w-0 flex-1 flex-col overflow-auto px-6 py-8">{children}</main>
    </div>
  );
}
