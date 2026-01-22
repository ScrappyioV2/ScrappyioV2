'use client'

import { useRouter } from 'next/navigation'
import { Home, ShieldAlert, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export default function UnauthorizedPage() {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.clear()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800 p-8 space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-rose-500/10 rounded-full">
              <ShieldAlert className="w-16 h-16 text-rose-400" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">Access Denied</h1>
            <p className="text-slate-400">
              You don't have permission to access this page.
            </p>
            <p className="text-sm text-slate-500">
              Please contact your administrator if you believe this is an error.
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
            >
              <Home size={20} />
              Go to Dashboard
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            >
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
