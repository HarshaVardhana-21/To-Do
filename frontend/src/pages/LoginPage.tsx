import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Layers,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getErrorMessage } from '../api/client'
import { Spinner } from '../components/Spinner'
import { Logo, ThemeToggle } from '../components/Navbar'
import { cn } from '../lib/utils'

const FIELD =
  'h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-[0.9375rem] text-slate-900 shadow-xs outline-none transition ' +
  'placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 ' +
  'dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-700'

const FIELD_ICON =
  'pointer-events-none absolute left-4 top-1/2 size-[1.125rem] -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-600 dark:group-focus-within:text-brand-100'

const PREVIEW_TASKS = [
  { title: 'Finalize Q4 roadmap', tag: 'High', tone: 'bg-rose-400', due: 'Today', done: true },
  { title: 'Review design critique notes', tag: 'Medium', tone: 'bg-amber-400', due: 'Tue', done: true },
  { title: 'Plan the team offsite', tag: 'Low', tone: 'bg-emerald-400', due: 'Fri', done: false },
]

const FEATURES = [
  { icon: Layers, text: 'Priorities that sort themselves' },
  { icon: BellRing, text: 'Due dates that flag what slips' },
  { icon: ShieldCheck, text: 'Private to your account' },
]

/** Decorative product preview on the brand panel. */
function PreviewCard() {
  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/40 ring-1 ring-inset ring-white/5 backdrop-blur-xl [padding:clamp(0.875rem,2.2vh,1.25rem)]"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-white/50">Today</span>
        <span className="font-mono text-[0.6875rem] tabular-nums text-white/60">2 / 3 done</span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-2/3 rounded-full bg-linear-to-r from-brand-500 via-violet-400 to-fuchsia-400" />
      </div>
      <ul className="mt-[clamp(0.75rem,1.8vh,1rem)] space-y-[clamp(0.375rem,0.9vh,0.5rem)]">
        {PREVIEW_TASKS.map((t) => (
          <li key={t.title} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-[clamp(0.375rem,1.1vh,0.625rem)]">
            <span
              className={cn(
                'flex size-[1.125rem] shrink-0 items-center justify-center rounded-full border-2',
                t.done ? 'border-brand-500 bg-brand-500 text-white' : 'border-white/25',
              )}
            >
              {t.done && <Check className="size-2.5" strokeWidth={3.5} />}
            </span>
            <span className={cn('flex-1 truncate text-sm font-medium', t.done ? 'text-white/40 line-through' : 'text-white/90')}>
              {t.title}
            </span>
            <span className="flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-white/50">
              <span className={cn('size-1.5 rounded-full', t.tone)} />
              {t.tag}
            </span>
            <span className="w-9 text-right font-mono text-[0.6875rem] text-white/40">{t.due}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function BrandPanel() {
  return (
    <aside className="relative hidden min-h-0 overflow-hidden border-r border-white/5 bg-slate-950 text-white lg:flex lg:flex-col lg:gap-[clamp(1.5rem,4vh,2.5rem)] lg:px-12 lg:py-[clamp(1.75rem,5vh,3.5rem)] xl:px-16">
      {/* Ambient light and a faint grid, faded out toward the edges. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 size-[34rem] rounded-full bg-brand-600/35 blur-3xl" />
        <div className="absolute -bottom-48 -right-32 size-[30rem] rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 size-72 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </div>

      <div className="relative shrink-0">
        <Logo />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col justify-center gap-[clamp(1rem,3.5vh,2.5rem)]">
        <div className="flex flex-col items-start gap-[clamp(0.75rem,2vh,1.25rem)]">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-white/70">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            Your day, composed
          </p>
          <p className="type-display max-w-lg text-[clamp(2rem,min(12vh_-_2.5rem,4.5vw),3.75rem)] font-medium leading-[1.05]">
            Clear the noise.
            <br />
            <span className="type-accent text-indigo-200!">Keep the flow.</span>
          </p>
          <p className="max-w-md text-[clamp(0.875rem,1.8vh,1rem)] leading-relaxed text-white/60">
            One calm place for everything on your plate, so you can spend less time organizing and more time finishing.
          </p>
        </div>
        <PreviewCard />
      </div>

      <ul className="relative grid w-full max-w-md shrink-0 grid-cols-3 gap-6 border-t border-white/10 pt-[clamp(1rem,2.5vh,1.5rem)] text-[0.8125rem] leading-snug text-white/60">
        {FEATURES.map(({ icon: Icon, text }) => (
          <li key={text} className="flex flex-col items-start gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
              <Icon className="size-3.5 text-indigo-200" />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </aside>
  )
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { from?: { pathname: string }; email?: string } | null
  const from = state?.from?.pathname ?? '/'
  const registeredEmail = state?.email ?? ''

  const [email, setEmail] = useState(registeredEmail)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const trackCapsLock = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      toast.success('Welcome back!', { icon: '👋' })
      navigate(from, { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed'))
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <main className="relative flex min-h-0 flex-col overflow-x-hidden bg-white lg:overflow-y-auto dark:bg-slate-950">
        {/* Soft glow behind the form; the brand panel carries the color on large screens. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl lg:hidden"
        />

        <header className="relative flex h-16 shrink-0 items-center justify-between px-4 sm:px-8">
          <span className="lg:invisible">
            <Logo />
          </span>
          <ThemeToggle />
        </header>

        <div className="relative flex flex-1 items-center justify-center px-4 pb-[clamp(1rem,4vh,3rem)] pt-[clamp(1rem,3vh,2rem)] sm:px-8">
          <div className="w-full max-w-[400px]">
            <p className="eyebrow">Sign in</p>
            <h1 className="type-display mt-3 text-4xl font-medium sm:text-5xl">
              Welcome <span className="type-accent">back</span>
            </h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-slate-500 dark:text-slate-400">
              Sign in to pick up right where you left off.
            </p>

            {registeredEmail && !error && (
              <p className="mt-[clamp(1rem,2.5vh,1.5rem)] flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Your account is ready. Enter your password to continue as{' '}
                  <span className="break-all font-mono text-[0.8125rem] font-medium">{registeredEmail}</span>
                </span>
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-[clamp(1.25rem,3.5vh,2rem)] space-y-[clamp(0.875rem,2.2vh,1.25rem)]">
              {error && (
                <p
                  className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </p>
              )}

              <div>
                <label className="label" htmlFor="email">Email</label>
                <div className="group relative">
                  <Mail className={FIELD_ICON} aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    className={FIELD}
                    placeholder="you@company.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus={!registeredEmail}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <label className="label" htmlFor="password">Password</label>
                  <span aria-live="polite" className="mb-1.5 text-[0.6875rem] font-semibold text-amber-600 dark:text-amber-400">
                    {capsLock && 'Caps Lock is on'}
                  </span>
                </div>
                <div className="group relative">
                  <Lock className={FIELD_ICON} aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className={cn(FIELD, 'pr-12')}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={trackCapsLock}
                    onKeyUp={trackCapsLock}
                    onBlur={() => setCapsLock(false)}
                    required
                    autoFocus={Boolean(registeredEmail)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label={showPassword ? 'Hide' : 'Show'}
                    aria-controls="password"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-linear-to-r from-brand-600 via-indigo-600 to-violet-600 px-4 text-[0.9375rem] font-semibold text-white shadow-lg shadow-brand-600/25 ring-1 ring-inset ring-white/10 transition hover:-translate-y-px hover:shadow-xl hover:shadow-brand-600/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {/* Light sweep on hover. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-linear-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[300%] motion-reduce:hidden"
                />
                {submitting && <Spinner />}
                Sign in
                {!submitting && (
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                )}
              </button>
            </form>

            <div className="mt-[clamp(1.25rem,3.5vh,2rem)] flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="eyebrow">New here</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <p className="mt-[clamp(0.75rem,2vh,1.25rem)] text-center text-sm text-slate-500 dark:text-slate-400">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="group inline-flex items-center gap-1 font-semibold text-brand-600 underline-offset-4 hover:underline dark:text-brand-100"
              >
                Create one
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </p>
          </div>
        </div>

        <footer className="relative flex shrink-0 items-center justify-center gap-2 px-4 pb-6 text-xs text-slate-400 dark:text-slate-500">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Your tasks are private to your account
        </footer>
      </main>
    </div>
  )
}
