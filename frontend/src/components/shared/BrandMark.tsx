import { useId } from 'react'

/**
 * ECE Copilot logo — an atom / node-network mark: three orbital rings (orange)
 * around a glowing nucleus, with electron nodes (white) on the orbits. Suggests
 * circuits + connected intelligence (the AI copilot). Pure SVG, no container box.
 * Two-tone orange + white. Scales to any `size`.
 */
export function BrandMark({ size = 24, className = '' }: { size?: number; className?: string }) {
  const gid = useId()
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="ECE Copilot logo"
    >
      <defs>
        <radialGradient id={`${gid}-core`} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#ffb38f" />
          <stop offset="0.55" stopColor="#ff6c37" />
          <stop offset="1" stopColor="#e85a26" />
        </radialGradient>
      </defs>

      {/* three orbital rings */}
      <g stroke="#ff6c37" strokeWidth="1.5" fill="none" opacity="0.95">
        <ellipse cx="16" cy="16" rx="13" ry="5.4" />
        <ellipse cx="16" cy="16" rx="13" ry="5.4" transform="rotate(60 16 16)" />
        <ellipse cx="16" cy="16" rx="13" ry="5.4" transform="rotate(120 16 16)" />
      </g>

      {/* electron nodes on the orbits (white, orange-ringed) */}
      <g fill="#ffffff" stroke="#ff6c37" strokeWidth="1">
        <circle cx="29" cy="16" r="2.1" />
        <circle cx="9.5" cy="27.3" r="2.1" />
        <circle cx="9.5" cy="4.7" r="2.1" />
      </g>

      {/* nucleus */}
      <circle cx="16" cy="16" r="4" fill={`url(#${gid}-core)`} />
      <circle cx="16" cy="16" r="4" fill="none" stroke="#ffffff" strokeWidth="0.9" opacity="0.85" />
    </svg>
  )
}
