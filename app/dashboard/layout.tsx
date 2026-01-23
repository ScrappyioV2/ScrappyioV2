"use client";

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
// Check your path (e.g. components/dashboard/Sidebar)
import Sidebar from '@/components/layout/Sidebar'; 

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter(); 

  useEffect(() => {
    // 1. Wait for loading
    if (loading) return;

    // 2. If NOT logged in, send to login
    if (!user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Loading Spinner (Only for initial auth check)
  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
        <p className="text-slate-400 animate-pulse">Loading Dashboard...</p>
      </div>
    );
  }

  // If not logged in (and waiting for redirect), show nothing
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