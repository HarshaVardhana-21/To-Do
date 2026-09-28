import { addTodo, createAccount, expect, signIn, test, todoItem } from './fixtures'

const statCard = (page: import('@playwright/test').Page, label: string) =>
  page.locator('.card').filter({ has: page.getByText(label, { exact: true }) }).first()

test.describe('todos (real backend)', () => {
  test('toasts stay on screen for about 3 seconds', async ({ authedPage: page }) => {
    const input = page.getByRole('textbox', { name: 'Title' }).first()
    await input.fill('Timed toast')
    await input.press('Enter')
    const toastEl = page.getByRole('status').filter({ hasText: 'Task added' })
    await expect(toastEl).toBeVisible()
    const shownAt = Date.now()
    await expect(toastEl).toBeHidden({ timeout: 6_000 })
    const elapsed = Date.now() - shownAt
    // react-hot-toast keeps a toast in the DOM ~1s after it starts fading, so 3s shows up as ~4s here.
    // A 2s duration (the old success default) would land near 3s, and 4s near 5s.
    expect(elapsed).toBeGreaterThan(3_500)
    expect(elapsed).toBeLessThan(4_600)
  })

  test('add, complete, and see stats update', async ({ authedPage: page }) => {
    await addTodo(page, 'Buy milk')
    await addTodo(page, 'Walk the dog')
    await expect(statCard(page, 'Total')).toContainText('2')

    await todoItem(page, 'Buy milk').getByRole('button', { name: 'Mark as done' }).click()
    await expect(todoItem(page, 'Buy milk').getByRole('button', { name: 'Mark as not done' })).toBeVisible()
    await expect(statCard(page, 'Completed')).toContainText('1')
    await expect(page.getByText('50%')).toBeVisible()

    // Survives a reload (really persisted in MongoDB).
    await page.reload()
    await expect(todoItem(page, 'Buy milk').getByRole('button', { name: 'Mark as not done' })).toBeVisible()
  })

  test('add with details, then edit every field', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: /more options/i }).click()
    await page.getByRole('textbox', { name: 'Title' }).fill('Quarterly report')
    await page.getByLabel('Description').fill('Numbers for Q3')
    await page.getByLabel('Priority', { exact: true }).selectOption('high')
    await page.getByLabel('Due date').fill('2030-05-20')
    await page.getByLabel('Tags').fill('Work, finance')
    await page.getByRole('button', { name: /^add$/i }).click()

    const item = todoItem(page, 'Quarterly report')
    await expect(item).toContainText('Numbers for Q3')
    await expect(item).toContainText('High')
    await expect(item).toContainText('May 20, 2030')
    await expect(item).toContainText('#work')
    await expect(item).toContainText('#finance')

    await item.getByRole('button', { name: 'Edit task' }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit task' })
    await expect(dialog.getByLabel('Due date')).toHaveValue('2030-05-20')
    await dialog.getByRole('textbox', { name: 'Title' }).fill('Annual report')
    await dialog.getByLabel('Priority').selectOption('low')
    await dialog.getByLabel('Tags').fill('work')
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(dialog).toBeHidden()

    const edited = todoItem(page, 'Annual report')
    await expect(edited).toContainText('Low')
    await expect(edited).not.toContainText('#finance')
  })

  test('regression: clearing a due date removes it (was saved as 1970 and shown overdue)', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: /more options/i }).click()
    await page.getByRole('textbox', { name: 'Title' }).fill('Dated task')
    await page.getByLabel('Due date').fill('2020-01-01')
    await page.getByRole('button', { name: /^add$/i }).click()
    await expect(todoItem(page, 'Dated task')).toContainText('Overdue')
    await expect(statCard(page, 'Overdue')).toContainText('1')

    await todoItem(page, 'Dated task').getByRole('button', { name: 'Edit task' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Due date').fill('')
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(dialog).toBeHidden()

    await page.reload()
    await expect(todoItem(page, 'Dated task')).not.toContainText('Overdue')
    await expect(todoItem(page, 'Dated task')).not.toContainText('1970')
    await expect(statCard(page, 'Overdue')).toContainText('0')
  })

  test('delete asks for confirmation', async ({ authedPage: page }) => {
    await addTodo(page, 'Temporary')
    await todoItem(page, 'Temporary').getByRole('button', { name: 'Delete task' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
    await expect(todoItem(page, 'Temporary')).toBeVisible()

    await todoItem(page, 'Temporary').getByRole('button', { name: 'Delete task' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(todoItem(page, 'Temporary')).toHaveCount(0)
    await page.reload()
    await expect(page.getByText("You're all caught up")).toBeVisible()
  })

  test('filter, search, sort and clear completed', async ({ authedPage: page }) => {
    for (const t of ['alpha task', 'Bravo task', 'charlie task']) await addTodo(page, t)
    await todoItem(page, 'Bravo task').getByRole('button', { name: 'Mark as done' }).click()
    await expect(page.getByRole('button', { name: 'Clear completed (1)' })).toBeVisible()

    await page.getByRole('tab', { name: 'Active' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(2)
    await page.getByRole('tab', { name: 'Completed' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(1)
    await page.getByRole('tab', { name: 'All' }).click()

    await page.getByRole('textbox', { name: 'Search tasks' }).fill('CHAR')
    await expect(page.getByRole('listitem')).toHaveCount(1)
    await expect(todoItem(page, 'charlie task')).toBeVisible()
    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(3)

    // Title sort is case-insensitive (regression for the backend collation fix).
    await page.getByLabel('Sort by').selectOption('title')
    await page.getByRole('button', { name: 'Sort order: descending' }).click()
    await expect(page.locator('li div.min-w-0 > p:first-child')).toHaveText(['alpha task', 'Bravo task', 'charlie task'])

    await page.getByRole('button', { name: 'Clear completed (1)' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(2)
    await expect(todoItem(page, 'Bravo task')).toHaveCount(0)
  })

  test('filter choices persist across reloads', async ({ authedPage: page }) => {
    await addTodo(page, 'Something')
    await page.getByRole('tab', { name: 'Completed' }).click()
    await page.getByLabel('Sort by').selectOption('priority')
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Completed' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByLabel('Sort by')).toHaveValue('priority')
    await expect(page.getByText('No matching tasks')).toBeVisible()
  })

  test('users never see each other’s tasks', async ({ browser, request }) => {
    const [alice, bob] = await Promise.all([createAccount(request, 'Alice A'), createAccount(request, 'Bob B')])
    const aliceCtx = await browser.newContext()
    const bobCtx = await browser.newContext()
    try {
      const alicePage = await aliceCtx.newPage()
      const bobPage = await bobCtx.newPage()
      await signIn(alicePage, alice)
      await signIn(bobPage, bob)

      await addTodo(alicePage, 'Alice private note')
      await bobPage.reload()
      await expect(bobPage.getByText("You're all caught up")).toBeVisible()
      await expect(bobPage.getByText('Alice private note')).toHaveCount(0)
    } finally {
      await aliceCtx.close()
      await bobCtx.close()
    }
  })

  test('dark mode toggles and persists without a flash on reload', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: 'Switch to dark mode' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
  })

  test('shows a friendly error when the API is down, and recovers', async ({ authedPage: page }) => {
    await page.route('**/api/todos?**', (route) => route.abort('connectionrefused'))
    await page.getByRole('tab', { name: 'Active' }).click()
    await expect(page.getByText('Cannot reach the server')).toBeVisible()
    await page.unroute('**/api/todos?**')
    await page.getByRole('button', { name: /try again/i }).click()
    // A filter is active, so the empty state is the "no matches" variant.
    await expect(page.getByText('No matching tasks')).toBeVisible()
  })
})
