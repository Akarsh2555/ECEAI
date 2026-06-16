import { useCallback } from 'react'
import { supabase, isDemoMode } from '../lib/supabaseClient'
import type { NetlistJSON, DomainType } from '../types/canvas'
import type { ArtifactBundle } from '../types/agent'
import type { DesignRow } from '../types/supabase'

/* ─── Demo data for development without Supabase ─── */
const DEMO_DESIGNS: DesignRow[] = [
  {
    id: 'demo-1',
    user_id: 'demo-user-001',
    title: '4-bit Adder',
    domain: 'digital',
    canvas_json: {},
    artifacts: {},
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    user_id: 'demo-user-001',
    title: 'QPSK Modulator',
    domain: 'system',
    canvas_json: {},
    artifacts: {},
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'demo-3',
    user_id: 'demo-user-001',
    title: 'Common Emitter Amplifier',
    domain: 'analog',
    canvas_json: {},
    artifacts: {},
    created_at: new Date(Date.now() - 259200000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
  },
]

export function useDesigns() {
  const listDesigns = useCallback(async (): Promise<DesignRow[]> => {
    if (isDemoMode) return DEMO_DESIGNS

    const { data, error } = await supabase
      .from('designs')
      .select('id, user_id, title, domain, canvas_json, artifacts, created_at, updated_at')
      .order('updated_at', { ascending: false })
    if (error) {
      // The designs table may not exist yet (migrations not pushed). Don't crash
      // the dashboard — the editor + AI chat work without persistence.
      console.warn('listDesigns failed (is the designs table created?):', error.message)
      return []
    }
    return data as DesignRow[]
  }, [])

  const getDesign = useCallback(async (id: string): Promise<DesignRow> => {
    if (isDemoMode) {
      const found = DEMO_DESIGNS.find((d) => d.id === id)
      if (!found) throw new Error('Design not found')
      return found
    }

    const { data, error } = await supabase
      .from('designs')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as DesignRow
  }, [])

  const createDesign = useCallback(
    async (
      title: string,
      domain: DomainType,
      canvasJson: NetlistJSON = { domain, nodes: [], edges: [], version: 1 }
    ): Promise<DesignRow> => {
      if (isDemoMode) {
        const newDesign: DesignRow = {
          id: `demo-${Date.now()}`,
          user_id: 'demo-user-001',
          title,
          domain,
          canvas_json: canvasJson,
          artifacts: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        DEMO_DESIGNS.unshift(newDesign)
        return newDesign
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('designs')
        .insert({ title, domain, canvas_json: canvasJson, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as DesignRow
    },
    []
  )

  const updateDesign = useCallback(
    async (
      id: string,
      patch: {
        canvas_json?: NetlistJSON
        artifacts?: ArtifactBundle
        title?: string
      }
    ) => {
      if (isDemoMode) return

      const { error } = await supabase.from('designs').update(patch).eq('id', id)
      if (error) throw error
    },
    []
  )

  const forkDesign = useCallback(
    async (id: string) => {
      const original = await getDesign(id)
      return createDesign(
        `${original.title} (fork)`,
        original.domain as DomainType,
        original.canvas_json as NetlistJSON
      )
    },
    [getDesign, createDesign]
  )

  const deleteDesign = useCallback(async (id: string) => {
    if (isDemoMode) {
      const idx = DEMO_DESIGNS.findIndex((d) => d.id === id)
      if (idx !== -1) DEMO_DESIGNS.splice(idx, 1)
      return
    }

    const { error } = await supabase.from('designs').delete().eq('id', id)
    if (error) throw error
  }, [])

  const uploadArtifactFile = useCallback(
    async (userId: string, designId: string, filename: string, content: string) => {
      if (isDemoMode) {
        // Return a blob URL in demo mode
        const blob = new Blob([content], { type: 'text/plain' })
        return URL.createObjectURL(blob)
      }

      const path = `${userId}/${designId}/${filename}`
      const { error } = await supabase.storage
        .from('artifacts')
        .upload(path, new Blob([content]), { upsert: true })
      if (error) throw error

      const { data: urlData } = supabase.storage.from('artifacts').getPublicUrl(path)
      return urlData.publicUrl
    },
    []
  )

  return {
    listDesigns,
    getDesign,
    createDesign,
    updateDesign,
    forkDesign,
    deleteDesign,
    uploadArtifactFile,
  }
}
