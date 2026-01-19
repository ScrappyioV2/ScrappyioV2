'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'

export default function PageGuard({ children }: { children: React.ReactNode }) {
  const { user, userRole, loading, hasPageAccess } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return

    // Redirect to login if not authenticated
    if (!user) {
      router.push('/')
      return
    }

    // Check if user has role assigned
    if (!userRole) {
      router.push('/unauthorized')
      return
    }

    // Check if user is active
    if (!userRole.is_active) {
      router.push('/unauthorized')
      return
    }

    // Check page access
    if (!hasPageAccess(pathname)) {
      router.push('/unauthorized')
      return
    }
  }, [user, userRole, loading, pathname, router, hasPageAccess])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || !userRole || !hasPageAccess(pathname)) {
    return null
  }

  return <>{children}</>
}
