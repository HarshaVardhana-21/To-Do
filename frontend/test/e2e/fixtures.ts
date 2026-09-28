import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test'

const API = 'http://localhost:5055/api'
let ipSeq = 0

export interface Account {
  name: string
  email: string
  password: string
  token: string
}

/**
 * Registers a user straight against the API. A unique X-Forwarded-For per account keeps
 * the auth rate limiter (50 req / 15 min per IP) from interfering with parallel tests.
 */
export async function createAccount(request: APIRequestContext, name = 'E2E User'): Promise<Account> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const password = 'password123'
  const ip = `10.${process.pid % 250}.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`
  const res = await request.post(`${API}/auth/register`, {
    data: { name, email, password },
    headers: { 'X-Forwarded-For': ip },
  })
  expect(res.status(), await res.text()).toBe(201)
  const { data } = await res.json()
  return { name, email, password, token: data.token }
}

export async function signIn(page: Page, account: Account) {
  await page.goto('/login')
  await page.evaluate((t) => localStorage.setItem('token', t), account.token)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: new RegExp(`, ${account.name.split(' ')[0]}$`) })).toBeVisible()
}

export async function addTodo(page: Page, title: string) {
  const input = page.getByRole('textbox', { name: 'Title' }).first()
  await input.fill(title)
  await input.press('Enter')
  await expect(page.getByRole('listitem').filter({ hasText: title })).toBeVisible()
}

export const todoItem = (page: Page, title: string) => page.getByRole('listitem').filter({ hasText: title })

export const test = base.extend<{ account: Account; authedPage: Page }>({
  account: async ({ request }, use) => {
    await use(await createAccount(request))
  },
  authedPage: async ({ page, account }, use) => {
    await signIn(page, account)
    await use(page)
  },
})

export { expect }
