import { AlertTriangle, CheckCircle2, Circle, ListTodo } from 'lucide-react'
import type { TodoStats } from '../types'
import { cn } from '../lib/utils'

export function StatsBar({ stats }: { stats: TodoStats }) {
  const pct = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0
  const items = [
    { label: 'Total', value: stats.total, icon: ListTodo, tone: 'text-brand-600 dark:text-brand-100' },
    { label: 'Active', value: stats.active, icon: Circle, tone: 'text-amber-600 dark:text-amber-400' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, tone: 'text-red-600 dark:text-red-400' },
  ]

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{label}</span>
              <Icon className={cn('size-4', tone)} />
            </div>
            <p className="type-display mt-2 text-4xl font-medium leading-none tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="eyebrow">Progress</span>
          <span className="font-mono text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </section>
  )
}
