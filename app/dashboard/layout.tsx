"use client";

import { useAuth, AuthProvider } from '@/lib/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { APP_ROUTES } from '@/lib/config/routes';
import { AppRoute } from '@/lib/types';

// 1. Inner Component
function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, hasPageAccess } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showSpinner, setShowSpinner] = useState(true);

  useEffect(() => {
    if (!authLoading) setShowSpinner(false);
    const safetyTimer = setTimeout(() => setShowSpinner(false), 2000);
    return () => clearTimeout(safetyTimer);
  }, [authLoading]);

  useEffect(() => {
    if (authLoading || showSpinner) return;
    if (!user) {
      router.push('/login');
      return;
    }

    const flattenRoutes = (routes: AppRoute[]): AppRoute[] => {
      return routes.reduce((acc, route) => {
        acc.push(route);
        if (route.subRoutes) acc.push(...flattenRoutes(route.subRoutes));
        return acc;
      }, [] as AppRoute[]);
    };

    const allRoutes = flattenRoutes(APP_ROUTES);
    const matchedRoute = allRoutes
      .sort((a, b) => b.path.length - a.path.length)
      .find(r => pathname === r.path || pathname.startsWith(`${r.path}/`));

    if (matchedRoute && !hasPageAccess(matchedRoute.permission)) {
       router.push('/unauthorized');
    }

  }, [pathname, user, authLoading, showSpinner, hasPageAccess, router]);

  if (showSpinner) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
        <p className="text-slate-400 animate-pulse">Loading Dashboard...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

// 2. Main Layout Wrapper
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardContent>
        {children}
      </DashboardContent>
    </AuthProvider>
  );
}