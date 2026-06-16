/* Turn an agent trace into clean, human-readable chat content.
 *
 * The LLM often replies with Markdown + LaTeX (e.g. "**bold**", "### Heading",
 * "$G(s) = \frac{1}{s+1}$"). We strip that formatting so the chat reads as plain
 * prose, and we split the runner's "[node_name] message" prefix into a friendly
 * step label. */

/* Cursor-style AI timeline: each LangGraph node maps to a phase color so the
 * user sees exactly what the agent is doing (masterdesign.md §3).
 *   routing #9fbbe0 · thinking #dfa88f · generating #c0a8dd · done #00d992 */
export const TIMELINE_COLORS = {
  routing: '#9fbbe0',
  thinking: '#dfa88f',
  generating: '#c0a8dd',
  done: '#00d992',
  error: '#cf2d56',
} as const

export type TimelinePhase = keyof typeof TIMELINE_COLORS

const NODE_LABELS: Record<string, { label: string; phase: TimelinePhase }> = {
  ingestion_router: { label: 'Routing', phase: 'routing' },
  digital_validator: { label: 'Validation', phase: 'routing' },
  analog_validator: { label: 'Validation', phase: 'routing' },
  logic_analyzer: { label: 'Analysis', phase: 'thinking' },
  analog_analyzer: { label: 'Analysis', phase: 'thinking' },
  system_simulator: { label: 'Simulation', phase: 'generating' },
  chat_responder: { label: 'Reply', phase: 'done' },
  hitl: { label: 'Review', phase: 'thinking' },
  hdl_compiler: { label: 'Verilog', phase: 'generating' },
  script_generator: { label: 'Scripts', phase: 'generating' },
  bom_optimizer: { label: 'BOM', phase: 'generating' },
}

/** Strip Markdown and LaTeX down to readable plain text. */
export function toReadableText(input: string): string {
  let s = input

  // LaTeX fractions and common wrappers.
  s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)')
  s = s.replace(/\\(?:text|mathrm|mathbf|mathit|mathcal|operatorname)\s*\{([^{}]*)\}/g, '$1')
  // Common LaTeX symbols → readable unicode.
  const symbols: Record<string, string> = {
    '\\times': '×', '\\cdot': '·', '\\pi': 'π', '\\omega': 'ω', '\\approx': '≈',
    '\\pm': '±', '\\leq': '≤', '\\geq': '≥', '\\infty': '∞', '\\Delta': 'Δ', '\\theta': 'θ',
  }
  for (const [tex, uni] of Object.entries(symbols)) {
    s = s.split(tex).join(uni)
  }
  // Any other \command — drop the command, keep nothing.
  s = s.replace(/\\[a-zA-Z]+/g, '')
  // Inline / block math delimiters: keep the inner text.
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, '$1')
  s = s.replace(/\$([^$\n]*)\$/g, '$1')
  // Leftover LaTeX braces.
  s = s.replace(/[{}]/g, '')

  // Markdown headings.
  s = s.replace(/^#{1,6}\s*/gm, '')
  // Bold / italic markers.
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/__([^_]+)__/g, '$1')
  s = s.replace(/\*([^*\n]+)\*/g, '$1')
  // Bullet markers → a clean dot.
  s = s.replace(/^\s*[-*]\s+/gm, '• ')
  // Inline code.
  s = s.replace(/`([^`]*)`/g, '$1')
  // Collapse excess blank lines and trailing spaces.
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')

  return s.trim()
}

export interface FormattedTrace {
  label: string | null   // friendly step label, e.g. "Analysis"
  color: string | null   // timeline pastel for the step chip
  text: string           // cleaned content
}

/** Parse "[node_name] message" into a friendly label + timeline color + cleaned content. */
export function formatTrace(message: string): FormattedTrace {
  const match = message.match(/^\[([a-z_]+)\]\s*([\s\S]*)$/)
  if (match) {
    const meta = NODE_LABELS[match[1]]
    const text = toReadableText(match[2])
    const isDone = /analysis complete|✅/i.test(text)
    return {
      label: meta?.label ?? null,
      color: isDone ? TIMELINE_COLORS.done : meta ? TIMELINE_COLORS[meta.phase] : null,
      text,
    }
  }
  return { label: null, color: null, text: toReadableText(message) }
}
