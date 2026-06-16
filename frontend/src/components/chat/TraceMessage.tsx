import { useState, useEffect } from 'react'
import type { TraceEntry } from '../../types/agent'
import { Bot, User, Sparkles } from 'lucide-react'
import { formatTrace } from '../../lib/formatMessage'

interface TraceMessageProps {
  trace: TraceEntry
}

function TypewriterText({ text, speed = 15 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    let index = 0
    setDisplayed('')
    
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, index + 1))
      index++
      if (index >= text.length) clearInterval(interval)
    }, speed)
    
    return () => clearInterval(interval)
  }, [text, speed])

  return <span>{displayed}</span>
}

export function TraceMessage({ trace }: TraceMessageProps) {
  const isUser = trace.message.startsWith('You:')
  const isError = trace.message.startsWith('Error:') || trace.message.startsWith('⚠️')

  if (isUser) {
    return (
      <div className="flex gap-2 flex-row-reverse animate-fade-in mb-3">
        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-indigo-600/25 border border-indigo-600/40">
          <User size={12} className="text-indigo-400" />
        </div>
        <div className="max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed bg-indigo-600/15 text-indigo-300 border border-indigo-600/30">
          {trace.message.replace('You: ', '')}
        </div>
      </div>
    )
  }

  const { label, color, text } = formatTrace(trace.message)
  const isReply = label === 'Reply'

  return (
    <div className={`flex gap-2 animate-fade-in ${isReply ? 'mt-2 mb-4' : 'mb-1'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border ${
        isError ? 'bg-rose-600/20 border-rose-600/40' : 
        isReply ? 'bg-indigo-600/20 border-indigo-600/40' : 'bg-slate-800 border-slate-700'
      }`}>
        {isReply ? (
          <Sparkles size={12} className="text-indigo-400" />
        ) : (
          <Bot size={12} className={isError ? 'text-rose-400' : 'text-slate-400'} />
        )}
      </div>
      <div className={`
        max-w-[85%] px-3 py-2 rounded-lg leading-relaxed whitespace-pre-wrap
        ${isError
          ? 'bg-rose-600/10 text-rose-300 border border-rose-600/25 text-xs'
          : isReply
          ? 'bg-slate-800/80 text-slate-200 border border-slate-700 text-sm shadow-sm'
          : 'bg-slate-900 text-slate-300 border border-slate-800 text-xs'}
      `}>
        {label && color && !isReply && (
          // Cursor-style timeline chip for agent traces
          <span
            className="eyebrow-mono inline-block mb-1.5 px-1.5 py-0.5 rounded"
            style={{ color, backgroundColor: `${color}14`, border: `1px solid ${color}33` }}
          >
            {label}
          </span>
        )}
        <div>{isReply ? <TypewriterText text={text} speed={15} /> : text}</div>
      </div>
    </div>
  )
}
