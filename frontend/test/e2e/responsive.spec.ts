import { addTodo, expect, test, todoItem } from './fixtures'

// Runs in both the desktop and the mobile (Pixel 7) projects.
test('layout fits the viewport with no horizontal scroll', async ({ authedPage: page }) => {
  await addTodo(page, 'A fairly long task title that should wrap nicely on small screens without overflowing')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('edit and delete controls are reachable on touch/small screens', async ({ authedPage: page }) => {
  await addTodo(page, 'Touch me')
  await expect(todoItem(page, 'Touch me').getByRole('button', { name: 'Edit task' })).toBeVisible()
  await expect(todoItem(page, 'Touch me').getByRole('button', { name: 'Delete task' })).toBeVisible()
})

test('login page fits the viewport', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeInViewport()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
