"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RestockRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/dropy/restock/dropy'); }, [router]);
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
    </div>
  );
}
