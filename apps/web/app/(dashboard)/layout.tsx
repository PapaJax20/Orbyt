import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { TRPCProvider } from "@/components/providers";
import { HouseholdGuard } from "@/components/household-guard";
import { MobileNav } from "@/components/mobile-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <TRPCProvider>
      <div className="flex h-screen overflow-hidden bg-bg">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader />
          <main className="flex-1 overflow-y-auto px-6 py-6 md:px-6 px-4">
            <HouseholdGuard>{children}</HouseholdGuard>
          </main>
        </div>
      </div>
      <MobileNav />
    </TRPCProvider>
  );
}
