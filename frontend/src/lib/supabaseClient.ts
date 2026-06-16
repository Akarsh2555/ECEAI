import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/* 
 * Singleton Supabase client.
 * Falls back to demo mode if env vars are not set — the app still renders
 * but auth/DB operations will fail gracefully.
 */
const isDemoMode = !SUPABASE_URL || SUPABASE_URL === 'https://your-project.supabase.co'

export const supabase = createClient<Database>(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)

export { isDemoMode }
