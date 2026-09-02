/**
 * Client-side mirrors of the host engine's settings shapes. Kept in sync with
 * src/index.ts manually: the browser bundle cannot import host modules (module
 * table purity), and the wire schema itself is what really validates both ends.
 */

/** M2 运行预算：任一字段超限即冻结例程。缺省 = 不限。 */
export interface RoutineBudget {
  maxTurns?: number
  maxTokens?: number
  maxSeconds?: number
}

/** One routine row as the host persists it. */
export interface RoutineRow {
  id: string
  name: string
  schedule: string
  prompt: string
  enabled: boolean
  provider?: string
  model?: string
  needsApproval?: boolean
  budget?: RoutineBudget
  reportSessionId?: string
  /** M3：连续失败次数（error/timeout/budget 累计，done 清零）。驱动指数退避。 */
  failStreak?: number
  lastRun?: {
    at: string
    runId: string
    status: string
    result: string
    turns: number
  }
}

/** The `grok-bot` settings namespace. */
export interface GrokBotSection {
  intervalSeconds?: number
  routines: RoutineRow[]
  /** One-shot manual-run request consumed by the host heartbeat. */
  trigger?: { routineId: string; token: number }
}

/** 一条运行轨迹（host `RunDetailItem` 投影）：turn 边界 / 工具调用 / 结束原因。 */
export interface RunDetailItem {
  t: 'turn' | 'tool' | 'step' | 'reason'
  turn: number
  step?: number
  text: string
}

/** One rolling run-log entry as the host records it. */
export interface RunEntry {
  routineId: string
  name: string
  runId: string
  at: string
  status: 'done' | 'error' | 'timeout' | 'budget' | 'denied'
  result: string
  turns: number
  reason?: string
  /** M3：该轮结束后的例程连败计数（>0 驱动退避）。 */
  failStreak?: number
  /** M4：结构化运行轨迹（bot-logs 详情）。 */
  detail?: RunDetailItem[]
}

/** The `grok-runs` settings namespace. */
export interface GrokRunsSection {
  runs: RunEntry[]
}

/** 运行中的实时快照（host `grok-active` 命名空间）。 */
export interface ActiveRunSnapshot {
  runId: string
  routineId: string
  name: string
  status: 'queued' | 'approving' | 'running' | 'cancelling'
  startedAt: string
  progress: { turns: number; tokens: number; elapsedMs: number }
  budget?: { maxTurns?: number; maxTokens?: number; maxSeconds?: number }
}

/** The `grok-active` settings namespace. */
export interface GrokActiveSection {
  runs: ActiveRunSnapshot[]
}

/** 一条审批卡（host `grok-approvals` 命名空间）。 */
export interface ApprovalRequest {
  id: string
  routineId: string
  name: string
  summary: string
  at: string
  expiresAt: string
  status: 'pending' | 'approved' | 'denied'
  decidedAt?: string
}

/** The `grok-approvals` settings namespace. */
export interface GrokApprovalsSection {
  requests: ApprovalRequest[]
}