import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useDebounce } from '../../src/hooks/useDebounce'
import { useTheme } from '../../src/hooks/useTheme'
import { useAuth } from '../../src/hooks/useAuth'
import { AuthProvider } from '../../src/context/AuthContext'

describe('useDebounce', () => {
  afterEach(() => vi.useRealTimers())

  it('only emits the latest value after the delay', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), { initialProps: { v: 'a' } })
    expect(result.current).toBe('a')

    rerender({ v: 'ab' })
    act(() => vi.advanceTimersByTime(200))
    rerender({ v: 'abc' })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('a') // timer restarted by the second change

    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe('abc')
  })

  it('defaults to 300ms', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useDebounce(v), { initialProps: { v: 1 } })
    rerender({ v: 2 })
    act(() => vi.advanceTimersByTime(299))
    expect(result.current).toBe(1)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(2)
  })
})

describe('useTheme', () => {
  it('reads the initial theme from the <html> class', () => {
    document.documentElement.classList.add('dark')
    expect(renderHook(() => useTheme()).result.current.theme).toBe('dark')
  })

  it('toggles the class and persists the choice', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')

    act(() => result.current.toggle())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('theme')).toBe('dark')

    act(() => result.current.toggle())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('still toggles when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    const { result } = renderHook(() => useTheme())
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('dark')
  })
})

describe('useAuth', () => {
  it('throws a helpful error outside AuthProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used inside <AuthProvider>')
  })

  it('works inside AuthProvider', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false) // no stored token → nothing to restore
  })
})
