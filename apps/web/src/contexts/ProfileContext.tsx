'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { getProfile } from '@/lib/database'

interface ProfileContextType {
  profile: any | null
  loading: boolean
  isAdmin: boolean
  isSubAgent: boolean
  refetch: () => void
}

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  loading: true,
  isAdmin: false,
  isSubAgent: false,
  refetch: () => {},
})

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }
    try {
      const data = await getProfile()
      setProfile(data)
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const role = profile?.role ?? ''
  const isAdmin = role === 'admin' || role === 'agent'
  const isSubAgent = role === 'subagent'

  return (
    <ProfileContext.Provider value={{ profile, loading, isAdmin, isSubAgent, refetch: fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
