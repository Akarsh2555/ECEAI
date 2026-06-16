import { useNavigate } from 'react-router-dom'
import { Button } from '../components/shared/Button'
import { Home } from 'lucide-react'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
      <h1 className="text-6xl font-bold text-slate-700 mb-4">404</h1>
      <p className="text-slate-400 mb-6">Page not found</p>
      <Button icon={<Home size={14} />} onClick={() => navigate('/dashboard')}>
        Back to Dashboard
      </Button>
    </div>
  )
}
