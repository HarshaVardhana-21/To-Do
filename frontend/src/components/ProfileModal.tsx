import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { getErrorMessage } from '../api/client'
import { AVATAR_MAX_FILE_BYTES, AVATAR_TYPES, resizeImage } from '../lib/image'
import type { User } from '../types'
import { Avatar } from './Avatar'
import { Modal } from './Modal'
import { Spinner } from './Spinner'

const ABOUT_MAX_LENGTH = 500

interface ProfileModalProps {
  open: boolean
  onClose: () => void
}

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user } = useAuth()
  if (!user) return null
  return (
    <Modal open={open} title="Your profile" onClose={onClose}>
      {/* Modal unmounts its children when closed, so each opening starts from the saved profile. */}
      <ProfileForm user={user} onDone={onClose} />
    </Modal>
  )
}

function ProfileForm({ user, onDone }: { user: User; onDone: () => void }) {
  const { updateProfile } = useAuth()
  const id = useId()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(user.name)
  const [about, setAbout] = useState(user.about)
  const [avatar, setAvatar] = useState(user.avatar)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file) return
    setError(null)
    if (!AVATAR_TYPES.includes(file.type)) return setError('Choose a PNG, JPEG or WebP image')
    if (file.size > AVATAR_MAX_FILE_BYTES) return setError('Image must be 5 MB or smaller')
    setProcessing(true)
    try {
      setAvatar(await resizeImage(file))
    } catch {
      setError('Could not read that image')
    } finally {
      setProcessing(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Name is required')
    setSaving(true)
    try {
      await updateProfile({ name: name.trim(), about: about.trim(), avatar })
      toast.success('Profile updated', { icon: '😎' })
      onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update your profile'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <Avatar name={name.trim() || user.name} src={avatar} className="size-16 text-lg" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={AVATAR_TYPES.join(',')}
            className="hidden"
            onChange={onFile}
            data-testid="avatar-input"
          />
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={processing}>
            {processing ? <Spinner /> : <Camera className="size-4" />}
            {avatar ? 'Change photo' : 'Upload photo'}
          </button>
          {avatar && (
            <button type="button" className="btn-ghost" onClick={() => setAvatar(null)}>
              <Trash2 className="size-4" />
              Remove
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`${id}-name`}>Name</label>
        <input
          id={`${id}-name`}
          className="input"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor={`${id}-email`}>Email</label>
        <input id={`${id}-email`} className="input font-mono text-[0.8125rem] opacity-70" value={user.email} readOnly disabled />
      </div>
      <div>
        <label className="label" htmlFor={`${id}-about`}>About you</label>
        <textarea
          id={`${id}-about`}
          className="input min-h-28 resize-y"
          placeholder="A few words about yourself, your role, or what you're working on"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          maxLength={ABOUT_MAX_LENGTH}
          aria-describedby={`${id}-about-count`}
        />
        <p id={`${id}-about-count`} className="mt-1 text-right font-mono text-[0.6875rem] tabular-nums text-slate-500 dark:text-slate-400">
          {about.length}/{ABOUT_MAX_LENGTH}
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving || processing}>
          {saving && <Spinner />}
          Save profile
        </button>
      </div>
    </form>
  )
}
