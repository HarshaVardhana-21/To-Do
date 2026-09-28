import { ClipboardList } from 'lucide-react'

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-100">
        <ClipboardList className="size-6" />
      </div>
      <h3 className="type-display text-xl font-medium">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  )
}
