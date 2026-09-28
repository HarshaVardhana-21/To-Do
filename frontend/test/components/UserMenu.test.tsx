import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Navbar } from '../../src/components/Navbar'
import { resizeImage } from '../../src/lib/image'
import { server } from '../mocks/server'
import { db } from '../mocks/db'
import { renderApp, renderWithProviders, signInAs } from '../helpers/render'

// Canvas image decoding isn't available in jsdom; resizeImage has its own unit test.
vi.mock('../../src/lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/image')>()),
  resizeImage: vi.fn(async () => 'data:image/jpeg;base64,RESIZED'),
}))

const AVATAR = 'data:image/png;base64,AAAA'
type User = ReturnType<typeof renderWithProviders>['user']

async function openMenu(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Open menu' }))
  return screen.getByRole('menu', { name: 'Account menu' })
}

async function openProfile(user: User) {
  await openMenu(user)
  await user.click(screen.getByRole('menuitem', { name: 'Profile' }))
  return screen.getByRole('dialog', { name: 'Your profile' })
}

describe('Navbar header', () => {
  it('shows the logo, app name, theme toggle, profile picture, name, email and menu', async () => {
    signInAs({ name: 'Grace Hopper', email: 'grace@example.com', avatar: AVATAR })
    renderWithProviders(<Navbar />)
    const header = screen.getByRole('banner')
    expect(await within(header).findByText('Grace Hopper')).toBeInTheDocument()
    expect(within(header).getByText('TaskFlow')).toBeInTheDocument()
    expect(within(header).getByText('grace@example.com')).toBeInTheDocument()
    expect(within(header).getByRole('img', { name: "Grace Hopper's profile picture" })).toHaveAttribute('src', AVATAR)
    expect(within(header).getByRole('button', { name: /switch to (dark|light) mode/i })).toBeInTheDocument()
    expect(within(header).getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('UserMenu', () => {
  it('opens with the user summary and Profile / Log out options, focusing the first item', async () => {
    signInAs({ name: 'Grace Hopper', email: 'grace@example.com' })
    const { user } = renderWithProviders(<Navbar />)
    const menu = await openMenu(user)
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(menu).getByText('grace@example.com')).toBeInTheDocument()
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Profile', 'Log out'])
    expect(within(menu).getByRole('menuitem', { name: 'Profile' })).toHaveFocus()
  })

  it('supports arrow-key navigation and closes on Escape, returning focus to the button', async () => {
    signInAs()
    const { user } = renderWithProviders(<Navbar />)
    await openMenu(user)
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toHaveFocus()
    await user.keyboard('{ArrowDown}') // wraps
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus()
  })

  it('closes when clicking outside, tabbing away, or toggling the button', async () => {
    signInAs()
    const { user } = renderWithProviders(<Navbar />)
    await openMenu(user)
    await user.click(screen.getByText('TaskFlow'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await openMenu(user)
    await user.tab()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await openMenu(user)
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('logs out from the menu and returns to the login page', async () => {
    signInAs({ name: 'Grace Hopper' })
    const { user } = renderApp('/')
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }))
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(localStorage.getItem('token')).toBeNull()
  })
})

describe('ProfileModal', () => {
  it('prefills the saved profile and saves name and about', async () => {
    const { user: me } = signInAs({ name: 'Grace Hopper', email: 'grace@example.com', about: 'Rear admiral' })
    const { user } = renderApp('/')
    const dialog = await openProfile(user)
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Grace Hopper')
    expect(within(dialog).getByLabelText('Email')).toHaveValue('grace@example.com')
    expect(within(dialog).getByLabelText('Email')).toBeDisabled()
    expect(within(dialog).getByLabelText('About you')).toHaveValue('Rear admiral')
    expect(within(dialog).getByText('12/500')).toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText('Name'))
    await user.type(within(dialog).getByLabelText('Name'), 'Amazing Grace')
    await user.clear(within(dialog).getByLabelText('About you'))
    await user.type(within(dialog).getByLabelText('About you'), '  Wrote the first compiler.  ')
    await user.click(within(dialog).getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('Profile updated')).toBeInTheDocument()
    expect(screen.getByText('😎')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByText('Amazing Grace')).toBeInTheDocument()
    expect(db.findUserById(me.id)).toMatchObject({ name: 'Amazing Grace', about: 'Wrote the first compiler.' })
  })

  it('uploads a resized photo and can remove it again', async () => {
    const { user: me } = signInAs({ name: 'Grace Hopper' })
    const { user } = renderApp('/')
    const dialog = await openProfile(user)
    expect(within(dialog).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()

    await user.upload(within(dialog).getByTestId('avatar-input'), new File(['x'], 'me.png', { type: 'image/png' }))
    expect(await within(dialog).findByRole('img', { name: /profile picture/ })).toHaveAttribute('src', 'data:image/jpeg;base64,RESIZED')
    await user.click(within(dialog).getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(db.findUserById(me.id)?.avatar).toBe('data:image/jpeg;base64,RESIZED'))
    expect(within(screen.getByRole('banner')).getByRole('img', { name: /profile picture/ })).toBeInTheDocument()

    const again = await openProfile(user)
    await user.click(within(again).getByRole('button', { name: 'Remove' }))
    expect(within(again).queryByRole('img')).not.toBeInTheDocument()
    await user.click(within(again).getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(db.findUserById(me.id)?.avatar).toBeNull())
  })

  it('rejects unsupported and oversized files without changing the picture', async () => {
    signInAs()
    const { user } = renderApp('/')
    const dialog = await openProfile(user)
    const input = within(dialog).getByTestId('avatar-input')

    const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 })
    await user.upload(input, big)
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Image must be 5 MB or smaller')

    // user.upload honors the accept filter, so bypass it the way an "All files" pick would
    fireEvent.change(input, { target: { files: [new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })] } })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Choose a PNG, JPEG or WebP image')
    expect(within(dialog).queryByRole('img')).not.toBeInTheDocument()
    expect(resizeImage).not.toHaveBeenCalled()
  })

  it('shows an error when the image cannot be read', async () => {
    vi.mocked(resizeImage).mockRejectedValueOnce(new Error('bad'))
    signInAs()
    const { user } = renderApp('/')
    const dialog = await openProfile(user)
    await user.upload(within(dialog).getByTestId('avatar-input'), new File(['x'], 'me.png', { type: 'image/png' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not read that image')
  })

  it('requires a name and keeps the dialog open on server errors', async () => {
    signInAs({ name: 'Grace Hopper' })
    server.use(http.patch('/api/auth/me', () => HttpResponse.json({ success: false, message: 'Server exploded' }, { status: 500 })))
    const { user } = renderApp('/')
    const dialog = await openProfile(user)

    await user.clear(within(dialog).getByLabelText('Name'))
    await user.type(within(dialog).getByLabelText('Name'), '   ')
    await user.click(within(dialog).getByRole('button', { name: 'Save profile' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Name is required')

    await user.type(within(dialog).getByLabelText('Name'), 'Grace')
    await user.click(within(dialog).getByRole('button', { name: 'Save profile' }))
    expect(await within(dialog).findByText('Server exploded')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save profile' })).toBeEnabled()
  })

  it('discards unsaved edits on cancel', async () => {
    signInAs({ name: 'Grace Hopper', about: 'Original' })
    const { user } = renderApp('/')
    let dialog = await openProfile(user)
    await user.type(within(dialog).getByLabelText('About you'), ' edited')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    dialog = await openProfile(user)
    expect(within(dialog).getByLabelText('About you')).toHaveValue('Original')
  })
})
