import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { LogOut, Menu, UserRound } from 'lucide-react'
import type { User } from '../types'
import { cn } from '../lib/utils'
import { Avatar } from './Avatar'

interface UserMenuProps {
  user: User
  onProfile: () => void
  onLogout: () => void
}

function MenuItem({ icon, children, onSelect, danger }: { icon: ReactNode; children: ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium outline-none transition hover:bg-slate-100 focus-visible:bg-slate-100 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800',
        danger ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function UserMenu({ user, onProfile, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  const close = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    items()[0]?.focus()
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function onMenuKeyDown(e: KeyboardEvent) {
    const list = items()
    const i = list.indexOf(document.activeElement as HTMLElement)
    const focusAt = (n: number) => list[(n + list.length) % list.length]?.focus()
    if (e.key === 'Escape') close()
    else if (e.key === 'Tab') setOpen(false)
    else if (e.key === 'ArrowDown') focusAt(i + 1)
    else if (e.key === 'ArrowUp') focusAt(i - 1)
    else if (e.key === 'Home') focusAt(0)
    else if (e.key === 'End') focusAt(list.length - 1)
    else return
    if (e.key !== 'Tab') e.preventDefault()
  }

  const select = (action: () => void) => () => {
    close(false)
    action()
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="btn-ghost"
        aria-label="Open menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Account menu"
          onKeyDown={onMenuKeyDown}
          className="card absolute right-0 top-full z-40 mt-2 w-64 p-1.5 shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-slate-200 px-3 pb-3 pt-2 dark:border-slate-800">
            <Avatar name={user.name} src={user.avatar} className="size-10 text-sm" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate font-mono text-[0.6875rem] text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
          </div>
          <div className="pt-1.5">
            <MenuItem icon={<UserRound className="size-4" />} onSelect={select(onProfile)}>
              Profile
            </MenuItem>
            <MenuItem icon={<LogOut className="size-4" />} onSelect={select(onLogout)} danger>
              Log out
            </MenuItem>
          </div>
        </div>
      )}
    </div>
  )
}
