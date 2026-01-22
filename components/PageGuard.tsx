'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { Loader2 } from 'lucide-react'

type Props = {
  children: ReactNode
  requiredPage?: string
}

const PageGuard = ({ children, requiredPage }: Props) => {
  const { user, loading, hasPageAccess } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push('/')
      return
    }

    if (requiredPage && !hasPageAccess(requiredPage)) {
      console.log(`❌ Access denied to ${requiredPage}`)
      router.push('/unauthorized')
      return
    }
  }, [user, loading, requiredPage, hasPageAccess, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-500 mx-auto" />
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || (requiredPage && !hasPageAccess(requiredPage))) {
    return null
  }

  return <>{children}</>
}

export default PageGuard