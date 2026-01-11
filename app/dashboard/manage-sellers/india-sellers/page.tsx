'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function IndiaSellersPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.push('/dashboard/manage-sellers/add-seller?country=india');
  }, [router]);
  
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Loading India Sellers...</p>
      </div>
    </div>
  );
}
