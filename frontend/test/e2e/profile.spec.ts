import { expect, test } from './fixtures'

// 2x1 PNG (one red, one blue pixel) so the real browser has to decode, crop and re-encode it.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGP4z8DAwPAfAAcAAf9+CLHQAAAAAElFTkSuQmCC',
  'base64',
)

test('header menu opens the profile, and profile changes persist across reloads', async ({ authedPage: page, account }) => {
  const header = page.getByRole('banner')
  await expect(header.getByText('TaskFlow')).toBeVisible()
  await expect(header.getByText(account.email)).toBeVisible()
  await expect(header.getByRole('button', { name: /switch to (dark|light) mode/i })).toBeVisible()

  await header.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('menuitem', { name: 'Profile' }).click()
  const dialog = page.getByRole('dialog', { name: 'Your profile' })

  await dialog.getByLabel('Name').fill('Katherine Johnson')
  await dialog.getByLabel('About you').fill('Computed trajectories for Apollo 11.')
  await dialog.getByTestId('avatar-input').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG })
  await expect(dialog.getByRole('img', { name: /profile picture/ })).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  await dialog.getByRole('button', { name: 'Save profile' }).click()

  await expect(page.getByText('Profile updated')).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(header.getByText('Katherine Johnson')).toBeVisible()

  await page.reload()
  await expect(header.getByRole('img', { name: "Katherine Johnson's profile picture" })).toBeVisible()
  await header.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('menuitem', { name: 'Profile' }).click()
  await expect(dialog.getByLabel('About you')).toHaveValue('Computed trajectories for Apollo 11.')
})
