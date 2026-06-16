import { useCallback, useRef, type DragEvent } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  ConnectionMode,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasStore } from '../../store/canvasStore'
import { GateNode } from './nodes/GateNode'
import { MuxNode } from './nodes/MuxNode'
import { FlipFlopNode } from './nodes/FlipFlopNode'
import { AdderNode } from './nodes/AdderNode'
import { AnalogNode } from './nodes/AnalogNode'
import { SystemBlockNode } from './nodes/SystemBlockNode'
import { CircuitEdge } from './edges/CircuitEdge'

const nodeTypes = {
  gate: GateNode,
  mux: MuxNode,
  flipflop: FlipFlopNode,
  adder: AdderNode,
  analog: AnalogNode,
  systemBlock: SystemBlockNode,
}

const edgeTypes = {
  circuit: CircuitEdge,
}

let nodeIdCounter = 0

function CanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  // The Zustand store is the single source of truth for the canvas — it backs
  // toNetlistJSON(), which is what gets submitted to the backend. All mutations
  // (connect, drop) must go through the store, not React Flow's internal store,
  // or the netlist sent to the backend would be empty.
  const { nodes, edges, domain, onNodesChange, onEdgesChange, onConnect, addNode, setSelectedNodeId } = useCanvasStore()
  const { screenToFlowPosition } = useReactFlow()

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()

      const rawData = event.dataTransfer.getData('application/ece-node')
      if (!rawData) return

      try {
        const nodeData = JSON.parse(rawData)
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        })

        const newNode = {
          id: `node-${++nodeIdCounter}-${Date.now()}`,
          type: nodeData.nodeType,
          position,
          data: nodeData.data,
        }

        addNode(newNode)
      } catch {
        // Ignore invalid drop data
      }
    },
    [screenToFlowPosition, addNode]
  )

  return (
    <div ref={reactFlowWrapper} className="w-full h-full bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        onDragOver={onDragOver}
        onDrop={onDrop}
        // Analog circuits are undirected (any terminal ↔ any terminal), so they
        // need loose mode. Block diagrams (system/digital) are DIRECTED —
        // strict mode keeps every wire output→input so a sink can't be miswired
        // as a source (which would make the whole chain evaluate to zero).
        connectionMode={domain === 'analog' ? ConnectionMode.Loose : ConnectionMode.Strict}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{ type: 'circuit', animated: false }}
        className="bg-slate-950"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#23252a" gap={16} size={1} />
        <Controls className="!bg-slate-900 !border-slate-800" />
        <MiniMap
          className="!bg-slate-900"
          nodeColor="#ff6c37"
          maskColor="rgba(27, 30, 36, 0.75)"
        />
      </ReactFlow>
    </div>
  )
}

export function CircuitCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
