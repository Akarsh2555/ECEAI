import { useEffect, useState, useCallback } from 'react'
import { supabase, isDemoMode } from '../lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

/* Demo user for when Supabase is not configured */
const DEMO_USER: User = {
  id: 'demo-user-001',
  email: 'demo@ececopilot.dev',
  app_metadata: {},
  user_metadata: { full_name: 'Demo User' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User

export function useAuth() {
  const [user, setUser] = useState<User | null>(isDemoMode ? DEMO_USER : null)
  const [loading, setLoading] = useState(!isDemoMode)

  useEffect(() => {
    if (isDemoMode) return

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signIn = useCallback(
    (email: string, password: string) =>
      supabase.auth.signInWithPassword({ email, password }),
    []
  )

  const signUp = useCallback(
    (email: string, password: string) =>
      supabase.auth.signUp({ email, password }),
    []
  )

  const signInWithGitHub = useCallback(
    () => supabase.auth.signInWithOAuth({ provider: 'github' }),
    []
  )

  const signInWithGoogle = useCallback(
    () => supabase.auth.signInWithOAuth({ provider: 'google' }),
    []
  )

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  const getToken = useCallback(async () => {
    if (isDemoMode) return 'demo-token'
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  return { user, loading, signIn, signUp, signInWithGitHub, signInWithGoogle, signOut, getToken, isDemoMode }
}
