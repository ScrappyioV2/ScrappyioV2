"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Menu, Rocket, ShieldCheck } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { APP_ROUTES } from "@/lib/config/routes";
import { AppRoute } from "@/lib/types";
import { supabase } from '@/lib/supabaseClient'
import dynamic from 'next/dynamic'
const FloatingChat = dynamic(() => import('@/components/chat/FloatingChat'), { ssr: false })

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, userRole, loading, hasPageAccess } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [hasEverLoaded, setHasEverLoaded] = useState(false);

  // ✅ NEW: Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const segments = pathname.split('/').filter(Boolean);
    const pageName = segments[segments.length - 1] || 'Dashboard';
    const formatted = pageName
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    document.title = `${formatted} | Scrappy v2`;
  }, [pathname]);

  useEffect(() => {
    if (!user) return

    const checkActive = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('is_active')
          .eq('user_id', user.id)
          .single()

        if (!error && data && data.is_active === false) {
          localStorage.removeItem('scrappy_user_role')
          await supabase.auth.signOut()
          window.location.href = '/login?reason=deactivated'
        }
      } catch {
        console.warn('Could not verify active status, skipping check')
      }
    }

    checkActive()

    const channel = supabase
      .channel('user-active-check')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_roles',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const updated = payload.new as any
        if (updated.is_active === false) {
          localStorage.removeItem('scrappy_user_role')
          supabase.auth.signOut().then(() => {
            window.location.href = '/login?reason=deactivated'
          })
        }
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [user])

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) {
      if (!hasEverLoaded) setIsChecking(true);
      return;
    }


    // 1. No User → Redirect to Login
    if (!user) {
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
      router.push("/unauthorized");
      return;
    }


    setIsChecking(false);
    setHasEverLoaded(true);
  }, [user, loading, pathname, router, hasPageAccess]);


  // Loading State - Only on FIRST load
  if ((loading || isChecking) && !hasEverLoaded) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#111111]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        <p className="mt-4 text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }


  // If no user, render nothing (redirect is happening)
  if (!user) {
    return null;
  }


  // Render Dashboard
  return (
    <div className="flex h-screen bg-[#111111]">
      {/* ✅ Sidebar now receives mobile props */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ✅ Main area wrapper */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ✅ NEW: Mobile top bar — only visible on <md screens */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#111111] border-b border-white/[0.1]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#111111] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-orange-500" />
            <span className="font-bold text-white text-sm tracking-tight">Scrappy v2</span>
          </div>

          {/* Right side: role badge or spacer */}
          {userRole ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20">
              <ShieldCheck className="w-2.5 h-2.5" />
              {userRole.role}
            </span>
          ) : (
            <div className="w-5" /> // spacer to keep branding centered
          )}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-hidden bg-slate-50 transition-all duration-300">
          {children}
        </main>
      </div>
      <FloatingChat />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardContent>{children}</DashboardContent>;
}