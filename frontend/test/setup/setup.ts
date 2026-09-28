import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { toast } from 'react-hot-toast'
import { server } from '../mocks/server'
import { db } from '../mocks/db'

// jsdom has no matchMedia; react-hot-toast uses it for prefers-reduced-motion.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// Any request without a handler is a test bug: fail loudly.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

beforeEach(() => {
  db.reset()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

afterEach(() => {
  cleanup()
  toast.remove()
  server.resetHandlers()
})

afterAll(() => server.close())
