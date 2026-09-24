"use client";

import { AuthProvider, useAuth } from "@/components/AuthProvider";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import Logo from "@/components/Logo";
import RequireAuth from "@/components/RequireAuth";

export default function DashboardPage() {
  return (
    <AuthProvider>
      <RequireAuth>
        <Dashboard />
      </RequireAuth>
    </AuthProvider>
  );
}

function Dashboard() {
  const { user, signOut } = useAuth();

  return (
    <main className="min-h-screen bg-th-mist">
      <header className="flex items-center justify-between border-b border-th-haze px-6 py-4">
        <Logo size={28} />
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-th-orient/80 sm:inline">
            {user?.email}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg border border-th-haze px-3 py-1.5 text-sm font-medium text-th-regal transition-colors hover:border-th-sky hover:text-th-cerulean focus:outline-none focus-visible:ring-2 focus-visible:ring-th-sky"
          >
            Log out
          </button>
        </div>
      </header>

      <DashboardTabs />
    </main>
  );
}
