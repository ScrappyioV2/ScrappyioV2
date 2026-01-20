'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DashboardPage() {
  const { user, userRole, logout, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    console.log('🔍 Dashboard check:', { loading, user: user?.email, role: userRole?.role })

    // Redirect to login if not authenticated
    if (!loading && !user) {
      console.log('❌ No user, redirecting to login')
      router.push('/')
      return
    }
    
    // Redirect non-admins to their first allowed page
    if (!loading && user && userRole) {
      console.log('👤 User role:', userRole.role)
      console.log('📄 Allowed pages:', userRole.allowed_pages)
      
      if (userRole.role !== 'admin') {
        console.log('🚫 Not admin, finding first allowed page...')
        
        // Find first allowed page that's not dashboard
        const firstPage = userRole.allowed_pages.find(page => page !== 'dashboard' && page !== '*')
        
        console.log('📍 First page found:', firstPage)
        
        if (firstPage) {
          console.log('✅ Redirecting to:', `/dashboard/${firstPage}`)
          router.push(`/dashboard/${firstPage}`)
        } else {
          console.log('⚠️ No pages assigned')
          router.push('/unauthorized')
        }
      } else {
        console.log('✅ Admin user, staying on dashboard')
      }
    }
  }, [user, userRole, loading, router])

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Block non-admins (will redirect via useEffect)
  if (!user || !userRole || userRole.role !== 'admin') {
    return null
  }

  // Admin dashboard content
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {userRole?.full_name || user?.email}
          </p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>

      {/* Role Badge */}
      <div className="mb-6">
        <span className="px-4 py-2 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
          🔐 ADMIN ACCESS
        </span>
      </div>

      {/* Admin Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold mb-2 text-gray-900">System Access</h3>
          <p className="text-gray-600 text-sm">
            You have full access to all system features and modules.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold mb-2 text-gray-900">System Status</h3>
          <p className="text-green-600 text-sm font-semibold">
            ✓ All Systems Operational
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Quick Navigation</h3>
          <p className="text-gray-600 text-sm">
            Use the sidebar to access all available modules.
          </p>
        </div>
      </div>

      {/* Admin Notice */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-purple-900 font-semibold">
              🔒 Admin-Only Dashboard
            </p>
            <p className="text-sm text-purple-700 mt-1">
              This page is only visible to administrators. Non-admin users are automatically redirected to their assigned pages.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
