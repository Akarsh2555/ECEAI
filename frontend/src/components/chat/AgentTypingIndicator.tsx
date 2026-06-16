/* "Thinking" indicator — peach pastel from the Cursor AI timeline palette. */
const THINKING = '#dfa88f'

export function AgentTypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: THINKING,
              animation: 'typing-dots 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <span className="eyebrow-mono" style={{ color: THINKING }}>
        Agent processing
      </span>
    </div>
  )
}
