import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

function CircuitEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  })

  return (
    // Single crisp wire — the master design forbids blurred glow layers;
    // selection reads through color + weight only.
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: selected ? '#828fff' : '#4a4d55',
        strokeWidth: selected ? 2.5 : 1.5,
        transition: 'stroke 0.2s, stroke-width 0.2s',
      }}
    />
  )
}

export const CircuitEdge = memo(CircuitEdgeComponent)
