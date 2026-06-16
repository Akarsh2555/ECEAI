import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react'
import type { DomainType } from '../types/canvas'

interface CanvasState {
  nodes: Node[]
  edges: Edge[]
  domain: DomainType
  selectedNodeId: string | null
  setDomain: (d: DomainType) => void
  setSelectedNodeId: (id: string | null) => void
  updateNodeData: (id: string, patch: Record<string, unknown>) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (node: Node) => void
  removeNode: (nodeId: string) => void
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  reset: () => void
  toNetlistJSON: () => {
    domain: DomainType
    nodes: Node[]
    edges: Edge[]
    version: number
  }
  loadFromNetlist: (netlist: {
    domain: DomainType
    nodes: Node[]
    edges: Edge[]
  }) => void
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      nodes: [],
  edges: [],
  domain: 'digital',
  selectedNodeId: null,

  setDomain: (domain) => set({ domain }),

  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),

  updateNodeData: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
      ),
    })),

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as Node[] })),

  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) as Edge[] })),

  onConnect: (connection) =>
    set((s) => ({ edges: addEdge({ ...connection, type: 'circuit' }, s.edges) })),

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),

  removeNode: (nodeId) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    })),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  reset: () => set({ nodes: [], edges: [], selectedNodeId: null }),

  toNetlistJSON: () => {
    const { nodes, edges, domain } = get()
    return { domain, nodes, edges, version: 1 }
  },

  loadFromNetlist: (netlist) =>
    set({
      domain: netlist.domain,
      nodes: netlist.nodes,
      edges: netlist.edges,
    }),
    }),
    {
      name: 'ece-copilot-canvas-storage',
    }
  )
)
