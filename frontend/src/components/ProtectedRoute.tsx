import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Spinner } from './Spinner'

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="size-8 text-brand-600" />
    </div>
  )
}

/** Renders child routes only for signed-in users. */
export function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/** Renders child routes only for signed-out users (login/register). */
export function PublicOnlyRoute() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <FullPageSpinner />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}
