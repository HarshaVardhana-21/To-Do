import { createAccount, expect, test } from './fixtures'

test.describe('authentication', () => {
  test('a new user can register, sign in, and land on an empty dashboard', async ({ page }) => {
    const email = `new-${Date.now()}@example.com`
    await page.goto('/register')
    await page.getByLabel('Name').fill('Ada Lovelace')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill('analytical1')
    await page.getByLabel('Confirm password').fill('analytical1')
    await page.getByRole('button', { name: 'Create account' }).click()

    // bcrypt (cost 12) is intentionally slow, and parallel workers compete for CPU.
    await expect(page).toHaveURL('/login', { timeout: 20_000 })
    await expect(page.getByText('Account created! Please sign in.')).toBeVisible() // toast is short-lived: check first
    await expect(page.getByLabel('Email')).toHaveValue(email)
    await page.getByLabel('Password').fill('analytical1')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL('/', { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: /, Ada$/ })).toBeVisible()
    await expect(page.getByText("You're all caught up")).toBeVisible()
  })

  test('registering an existing email shows an error', async ({ page, request }) => {
    const existing = await createAccount(request)
    await page.goto('/register')
    await page.getByLabel('Name').fill('Dup')
    await page.getByLabel('Email').fill(existing.email)
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByLabel('Confirm password').fill('password123')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('alert')).toHaveText('An account with this email already exists')
    await expect(page).toHaveURL('/register')
  })

  test('login, reload persistence, and logout', async ({ page, account }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(account.email.toUpperCase()) // case-insensitive
    await page.getByLabel('Password').fill(account.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText(account.email)).toBeVisible()

    await page.reload()
    await expect(page).toHaveURL('/')
    await expect(page.getByText(account.email)).toBeVisible()

    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('menuitem', { name: 'Log out' }).click()
    await expect(page).toHaveURL('/login')
    await page.goto('/')
    await expect(page).toHaveURL('/login')
  })

  test('wrong password shows an error and does not sign in', async ({ page, account }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(account.email)
    await page.getByLabel('Password').fill('not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password')
    await expect(page).toHaveURL('/login')
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
  })

  test('a tampered token sends the user back to login', async ({ page }) => {
    await page.goto('/login')
    await page.evaluate(() => localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad'))
    await page.goto('/')
    await expect(page).toHaveURL('/login')
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
  })

  test('unknown routes show the 404 page', async ({ page }) => {
    await page.goto('/this/does/not/exist')
    await expect(page.getByText('404')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  })
})
