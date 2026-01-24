"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { APP_ROUTES } from "@/lib/config/routes";
import { AppRoute } from "@/lib/types";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading, hasPageAccess } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) {
      setIsChecking(true);
      return;
    }

    // 1. No User → Redirect to Login
    if (!user) {
      console.log("🔒 No user, redirecting to login");
      router.replace("/login");
      return;
    }

    // 2. Permission Check
    const flattenRoutes = (routes: AppRoute[]): AppRoute[] => {
      return routes.reduce((acc, route) => {
        acc.push(route);
        if (route.subRoutes) {
          acc.push(...flattenRoutes(route.subRoutes));
        }
        return acc;
      }, [] as AppRoute[]);
    };

    const allRoutes = flattenRoutes(APP_ROUTES);
    const matchedRoute = allRoutes
      .sort((a, b) => b.path.length - a.path.length) // Match longest path first
      .find((r) => pathname === r.path || pathname.startsWith(r.path));

    // If route is protected and user lacks permission → Unauthorized
    if (matchedRoute && !hasPageAccess(matchedRoute.permission)) {
      console.log("🚫 Access denied to:", pathname);
      router.push("/unauthorized");
      return;
    }

    console.log("✅ Access granted to:", pathname);
    setIsChecking(false);
  }, [user, loading, pathname, router, hasPageAccess]);

  // Loading State - Minimal & Fast
  if (loading || isChecking) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="mt-4 text-slate-400 text-sm">Loading...</p>
      </div>
    );
  }

  // If no user, render nothing (redirect is happening)
  if (!user) {
    return null;
  }

  // Render Dashboard
  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-50 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardContent>{children}</DashboardContent>;
}
