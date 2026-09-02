/**
 * Routine panel: one session-header action opening a popover with the routine
 * list (schedule, run-now, enable toggle), the M2 approval queue (allow/deny,
 * TTL countdown), and a rolling recent-runs feed. All data rides the Host
 * settings namespaces through `settingsScope` scopes — no custom RPC, reads
 * are reactive mirror snapshots, writes are path ops.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { NS, type GrokKey } from './locales.ts'
import type {
  ActiveRunSnapshot,
  ApprovalRequest,
  GrokActiveSection,
  GrokApprovalsSection,
  GrokBotSection,
  GrokRunsSection,
  RoutineRow,
  RunDetailItem,
  RunEntry,
} from './types.ts'

/** Full props: slot runtime/locale shares plus the four bound scopes. */
export type GrokPanelProps =
  PropsRuntime<'conversation.session.header.actions'>
  & PropsLocale<typeof NS>
  & {
    bot: SettingsScope<GrokBotSection>
    runs: SettingsScope<GrokRunsSection>
    approvals: SettingsScope<GrokApprovalsSection>
    active: SettingsScope<GrokActiveSection>
  }

function formatRunAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatClock(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** Foreground color per run status; pulse for the currently interested one. */
function statusColor(status: string): string {
  switch (status) {
    case 'done': return '#16a34a'
    case 'error': return '#dc2626'
    case 'timeout': return '#d97706'
    case 'budget': return '#9333ea'
    case 'denied': return '#64748b'
    default: return '#6b7280'
  }
}

/** Foreground color for the live-running status badge. */
function liveStatusColor(status: 'queued' | 'approving' | 'running' | 'cancelling'): string {
  switch (status) {
    case 'running': return '#16a34a'
    case 'approving': return '#d97706'
    case 'queued': return '#64748b'
    default: return '#6b7280'
  }
}

/** 剩余秒数（本地计算，不写回设置）。 */
function secondsLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

/**
 * Session-header entry point: renders nothing until the `grok-bot` namespace
 * has a ready section, then a trigger button and, when open, the popover.
 */
export function GrokPanel({ bot, runs, approvals, active, t }: GrokPanelProps) {
  const section = useSyncExternalStore(bot.subscribe.bind(bot), () => bot.getSnapshot())
  const runSection = useSyncExternalStore(runs.subscribe.bind(runs), () => runs.getSnapshot())
  const approvalSection = useSyncExternalStore(approvals.subscribe.bind(approvals), () => approvals.getSnapshot())
  const activeSection = useSyncExternalStore(active.subscribe.bind(active), () => active.getSnapshot())
  const [open, setOpen] = useState(false)
  const [queuedId, setQueuedId] = useState<string | undefined>()
  const [expandedRun, setExpandedRun] = useState<string | undefined>()
  const [, setNowTick] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  useDismissOnOutsidePointer(rootRef, open, setOpen)

  // 审批卡倒计时：挂起时每秒重渲染，驱动剩余秒数
  useEffect(() => {
    const handle = setInterval(() => { setNowTick((v) => v + 1) }, 1_000)
    return () => { clearInterval(handle) }
  }, [])

  const ready = section.status === 'ready'
  const routines = ready && section.value ? section.value.routines : undefined
  const history = runSection.status === 'ready' && runSection.value ? runSection.value.runs : undefined
  const approvalsData = approvalSection.status === 'ready' && approvalSection.value
    ? approvalSection.value.requests
    : undefined
  const live = activeSection.status === 'ready' && activeSection.value
    ? activeSection.value.runs
    : undefined
  const pending = (approvalsData ?? []).filter((r) => r.status === 'pending')
  const count = routines?.length ?? 0

  const runNow = (id: string): void => {
    setQueuedId(id)
    void bot.mutate([{ op: 'set', path: ['trigger'], value: { routineId: id, token: Date.now() } }])
  }
  const toggle = async (routine: RoutineRow): Promise<void> => {
    const next = (routines ?? []).map((r) => r.id === routine.id ? { ...r, enabled: !r.enabled } : r)
    await bot.mutate([{ op: 'set', path: ['routines'], value: next }])
    setQueuedId(routine.id)
    setTimeout(() => { setQueuedId(undefined) }, 2_500)
  }
  const decide = (request: ApprovalRequest, status: 'approved' | 'denied'): void => {
    const next = (approvalsData ?? []).map((r) => r.id === request.id
      ? { ...r, status, decidedAt: new Date().toISOString() }
      : r)
    void approvals.mutate([{ op: 'set', path: ['requests'], value: next }])
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex' } as const}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('trigger.aria')}
        title={t('trigger.label')}
        onClick={() => { setOpen(!open) }}
        style={{
          border: '1px solid #d1d5db', background: '#ffffff', borderRadius: 8,
          padding: '4px 10px', fontSize: 13, lineHeight: '20px', cursor: 'pointer',
        }}
      >
        {t('trigger.label')}{count > 0 ? ` · ${count}` : ''}{pending.length > 0 ? ` · ${pending.length}待批` : ''}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t('panel.title')}
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 50,
            width: 460, maxHeight: 560, overflowY: 'auto', boxSizing: 'border-box',
            background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.14)', padding: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{t('panel.title')}</div>
          {!ready && (
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              {section.status === 'unavailable' ? t('unavailable') : t('loading')}
            </div>
          )}
          {ready && routines !== undefined && routines.length === 0 && (
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{t('panel.empty')}</div>
          )}
          {(routines ?? []).map((routine) => (
            <div
              key={routine.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {routine.name}
                  <span style={{ marginLeft: 6, color: '#9ca3af', fontWeight: 400 }}>{routine.schedule}</span>
                  {routine.budget && (
                    <span title={t('badge.budget')} style={{ marginLeft: 6, fontSize: 11, color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 4, padding: '0 4px' }}>
                      {t('badge.budget')}
                    </span>
                  )}
                  {routine.reportSessionId && (
                    <span title={t('badge.report')} style={{ marginLeft: 6, fontSize: 11, color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 4, padding: '0 4px' }}>
                      {t('badge.report')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: routine.lastRun ? statusColor(routine.lastRun.status) : '#9ca3af' }}>
                  {routine.lastRun
                    ? `${t('last.run')} ${formatRunAt(routine.lastRun.at)} · ${t(`status.${routine.lastRun.status}`) as string}`
                    : '—'}
                  {typeof routine.failStreak === 'number' && routine.failStreak > 0 && (
                    <span
                      title={t('backoff.hint', { n: routine.failStreak })}
                      style={{ marginLeft: 6, fontSize: 11, color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, padding: '0 4px' }}
                    >
                      {t('streak.title')} {routine.failStreak}{t('streak.unit')}
                    </span>
                  )}
                </div>
                {routine.lastRun?.status === 'budget' && (
                  <div style={{ fontSize: 11, color: '#9333ea', marginTop: 2 }}>{t('frozen.hint')}</div>
                )}
              </div>
              {queuedId === routine.id && (
                <span style={{ fontSize: 12, color: '#6b7280' }}>{t('queued')}</span>
              )}
              {routine.lastRun?.status === 'budget'
                ? (
                  <button
                    type="button"
                    title={t('enable')}
                    onClick={() => { void toggle(routine) }}
                    style={{ border: '1px solid #7c3aed', borderRadius: 6, padding: '2px 8px', fontSize: 12, cursor: 'pointer', background: '#f5f3ff', color: '#7c3aed' }}
                  >
                    {t('enable')}
                  </button>
                )
                : (
                  <>
                    <button
                      type="button"
                      title={t('run.now')}
                      onClick={() => { runNow(routine.id) }}
                      style={{ border: '1px solid #d1d5db', background: '#ffffff', borderRadius: 6, padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}
                    >
                      {t('run.now')}
                    </button>
                    <button
                      type="button"
                      title={routine.enabled ? t('disable') : t('enable')}
                      onClick={() => { void toggle(routine) }}
                      style={{
                        border: '1px solid #d1d5db', borderRadius: 6, padding: '2px 8px', fontSize: 12, cursor: 'pointer',
                        background: routine.enabled ? '#ecfdf5' : '#f3f4f6',
                        color: routine.enabled ? '#047857' : '#6b7280',
                      }}
                    >
                      {routine.enabled ? t('disable') : t('enable')}
                    </button>
                  </>
                )}
            </div>
          ))}

          {(live ?? []).length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px' }}>{t('live.title')}</div>
              {(live ?? []).map((r: ActiveRunSnapshot) => (
                <div key={r.runId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: r.status === 'running' ? '#22c55e' : r.status === 'queued' ? '#f59e0b' : '#3b82f6',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.name}
                      </span>
                      {r.status === 'running' && r.budget && (
                        <span title={t('badge.budget')} style={{ fontSize: 11, color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 4, padding: '0 4px' }}>
                          {t('badge.budget')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      {r.status === 'running'
                        ? t('live.progress', {
                            turns: r.progress.turns,
                            tokens: r.progress.tokens,
                            secs: Math.round(r.progress.elapsedMs / 1000),
                          })
                        : r.status === 'approving'
                          ? t('live.approving.hint')
                          : r.status === 'queued'
                            ? t('live.queued.hint')
                            : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: liveStatusColor(r.status), flexShrink: 0 }}>
                    {t(`live.status.${r.status}` as GrokKey)}
                  </span>
                </div>
              ))}
            </>
          )}

          {pending.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px' }}>{t('approve.section')}</div>
              {(pending.slice(0, 4)).map((request) => (
                <div key={request.id} style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 8, padding: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{request.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 6px', wordBreak: 'break-all' }}>
                    {request.summary.slice(0, 120)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => { decide(request, 'approved') }}
                      style={{ border: '1px solid #16a34a', background: '#f0fdf4', color: '#15803d', borderRadius: 6, padding: '2px 12px', fontSize: 12, cursor: 'pointer' }}
                    >
                      {t('approve.approve')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { decide(request, 'denied') }}
                      style={{ border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', borderRadius: 6, padding: '2px 12px', fontSize: 12, cursor: 'pointer' }}
                    >
                      {t('approve.deny')}
                    </button>
                    <span style={{ fontSize: 12, color: '#d97706', marginLeft: 'auto' }}>
                      {secondsLeft(request.expiresAt) > 0
                        ? t('approve.expires', { secs: secondsLeft(request.expiresAt) })
                        : t('approve.decided', { status: t('approve.denied') })}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}

          <div style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px' }}>{t('history.title')}</div>
          {history === undefined || history.length === 0
            ? <div style={{ fontSize: 12, color: '#9ca3af' }}>{t('history.empty')}</div>
            : history.map((entry: RunEntry) => (
              <div key={entry.runId} style={{ padding: '3px 0' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12 }}>
                  <span style={{ color: statusColor(entry.status), fontWeight: 600, width: 44, flexShrink: 0 }}>
                    {t(`status.${entry.status}` as GrokKey)}
                  </span>
                  <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {entry.name} — {entry.result.slice(0, 60)}
                    {typeof entry.failStreak === 'number' && entry.failStreak > 1 && (
                      <span style={{ marginLeft: 6, color: '#dc2626', fontSize: 11 }}>[{t('streak.title')} {entry.failStreak}]</span>
                    )}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span style={{ color: '#9ca3af' }}>{formatRunAt(entry.at)}</span>
                    {(entry.detail ?? []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setExpandedRun(expandedRun === entry.runId ? undefined : entry.runId) }}
                        style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: 11, cursor: 'pointer', padding: 0 }}
                      >
                        {expandedRun === entry.runId ? t('detail.hide') : t('detail.show')}
                      </button>
                    )}
                  </span>
                </div>
                {entry.detail && expandedRun === entry.runId && (
                  <div style={{ margin: '4px 0 4px 44px', padding: 6, background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>{t('detail.title')}</div>
                    {entry.detail.length === 0
                      ? <div style={{ fontSize: 11, color: '#9ca3af' }}>{t('detail.empty')}</div>
                      : (entry.detail as RunDetailItem[]).map((d, i) => (
                        <div key={i} style={{ fontSize: 11, color: d.t === 'tool' ? '#0369a1' : '#6b7280', padding: '1px 0', wordBreak: 'break-all', fontFamily: 'ui-monospace, monospace' }}>
                          {d.t === 'tool'
                            ? <>⚙ {d.text}</>
                            : d.t === 'turn'
                              ? <>▶ {t('detail.turn', { n: d.turn })}</>
                              : d.text}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}