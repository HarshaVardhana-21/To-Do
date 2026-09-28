import { useCallback, useState } from 'react'
import { CheckSquare, Moon, Sun } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { Avatar } from './Avatar'
import { ProfileModal } from './ProfileModal'
import { UserMenu } from './UserMenu'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      className="btn-ghost"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <CheckSquare className="size-5" />
      </span>
      TaskFlow
    </span>
  )
}

export function Navbar() {
  const { user, logout } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const closeProfile = useCallback(() => setProfileOpen(false), [])

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4">
        <Logo />
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {user && (
            <>
              <div className="flex min-w-0 items-center gap-2 pl-1 sm:pl-2">
                <Avatar name={user.name} src={user.avatar} />
                <div className="hidden min-w-0 leading-tight sm:block">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                </div>
              </div>
              <UserMenu user={user} onProfile={() => setProfileOpen(true)} onLogout={logout} />
              <ProfileModal open={profileOpen} onClose={closeProfile} />
            </>
          )}
        </div>
      </div>
    </header>
  )
}
