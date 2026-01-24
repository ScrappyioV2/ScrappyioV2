import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-slate-200">
      <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
      <h1 className="text-4xl font-bold mb-2">Access Denied</h1>
      <p className="text-slate-400 mb-8">You do not have permission to view this page.</p>
      <Link 
        href="/dashboard" 
        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}