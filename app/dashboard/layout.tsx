"use client";

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar'; 

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  // Local state to control the spinner
  const [showSpinner, setShowSpinner] = useState(true);

  useEffect(() => {
    // 1. If auth is done loading, hide spinner
    if (!authLoading) {
      setShowSpinner(false);
    }

    // 2. FAILSAFE: Force spinner to hide after 2 seconds no matter what
    const safetyTimer = setTimeout(() => {
      setShowSpinner(false);
    }, 2000);

    return () => clearTimeout(safetyTimer);
  }, [authLoading]);

  // Redirect if spinner is gone and still no user
  useEffect(() => {
    if (!showSpinner && !user && !authLoading) {
      router.push('/login');
    }
  }, [showSpinner, user, authLoading, router]);

  // === RENDER ===

  if (showSpinner) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
        <p className="text-slate-400 animate-pulse">Loading Dashboard...</p>
      </div>
    );
  }

  // Prevent flash of content if user is missing (waiting for redirect)
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