/* ─── Supabase Database Types ─── */
/* These mirror the SQL schema in supabase/migrations/.
 * The shape (Tables/Views/Functions/Enums/CompositeTypes + Relationships)
 * is required by @supabase/supabase-js so that `.from()` resolves to a typed
 * builder instead of `never`. */

import type { NetlistJSON } from './canvas'
import type { ArtifactBundle } from './agent'

/* jsonb columns accept either a structured netlist/artifact bundle or an
 * arbitrary JSON object. */
type Json = NetlistJSON | ArtifactBundle | Record<string, unknown>

export interface Database {
  public: {
    Tables: {
      designs: {
        Row: {
          id: string
          user_id: string
          title: string
          domain: 'digital' | 'analog' | 'signal' | 'system'
          canvas_json: Json
          artifacts: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          domain: 'digital' | 'analog' | 'signal' | 'system'
          canvas_json?: Json
          artifacts?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          domain?: 'digital' | 'analog' | 'signal' | 'system'
          canvas_json?: Json
          artifacts?: Json
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          design_id: string | null
          user_id: string
          graph_state: Json
          status: 'running' | 'awaiting_approval' | 'complete' | 'error'
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          design_id?: string | null
          user_id: string
          graph_state?: Json
          status?: 'running' | 'awaiting_approval' | 'complete' | 'error'
          error_message?: string | null
        }
        Update: {
          graph_state?: Json
          status?: 'running' | 'awaiting_approval' | 'complete' | 'error'
          error_message?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

export type DesignRow = Database['public']['Tables']['designs']['Row']
export type DesignInsert = Database['public']['Tables']['designs']['Insert']
export type DesignUpdate = Database['public']['Tables']['designs']['Update']
export type SessionRow = Database['public']['Tables']['sessions']['Row']
