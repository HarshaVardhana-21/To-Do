import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="type-accent text-8xl leading-none">404</p>
      <h1 className="type-display mt-4 text-3xl font-medium">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary mt-6">
        Back to tasks
      </Link>
    </div>
  )
}
