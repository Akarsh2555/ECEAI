import { create } from 'zustand'
import type { ArtifactBundle } from '../types/agent'

interface ArtifactState {
  artifacts: ArtifactBundle
  activeTab: string
  setArtifact: (kind: string, payload: unknown) => void
  setActiveTab: (tab: string) => void
  clearArtifacts: () => void
}

const INITIAL_ARTIFACTS: ArtifactBundle = {}

export const useArtifactStore = create<ArtifactState>((set) => ({
  artifacts: INITIAL_ARTIFACTS,
  activeTab: 'truth_table',

  setArtifact: (kind, payload) =>
    set((s) => ({
      artifacts: { ...s.artifacts, [kind]: payload },
    })),

  setActiveTab: (tab) => set({ activeTab: tab }),

  clearArtifacts: () => set({ artifacts: INITIAL_ARTIFACTS }),
}))
