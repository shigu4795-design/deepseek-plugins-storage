/**
 * dsh-grok-bot client half: one session-header action — the routine panel.
 * Data rides the Host settings namespaces (`grok-bot` / `grok-runs`) through
 * `settingsScope` scopes; no custom RPC.
 *
 * Host rules: value-imports only from the frozen module table (react, cordis,
 * client-store, ui-slots, ui-primitives); every other package peers in as a
 * type-only import that vanishes at build time (bundle purity gate).
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only merges: conversation slot map, session/renderer/locale peers, and
// the settingsScope service face.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { GrokPanel } from './panel.tsx'
import { en, zh, type GrokKey } from './locales.ts'
import type { GrokActiveSection, GrokApprovalsSection, GrokBotSection, GrokRunsSection } from './types.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Routine panel copy. */
    'grok': GrokKey
  }
}

/** Required services: slot registration, dictionaries, settings scopes. */
export const inject = ['slots', 'locale', 'settingsScope']

/**
 * Client plugin body. Registers the dictionaries and the header action,
 * binding one settings scope apiece for the panel's reads and writes.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('grok', { zh, en }), 'grok-bot: dictionaries')
  const bot = ctx.settingsScope.bind<GrokBotSection>({ namespace: 'grok-bot' })
  const runs = ctx.settingsScope.bind<GrokRunsSection>({ namespace: 'grok-runs' })
  const approvals = ctx.settingsScope.bind<GrokApprovalsSection>({ namespace: 'grok-approvals' })
  const active = ctx.settingsScope.bind<GrokActiveSection>({ namespace: 'grok-active' })
  ctx.slots.inject(
    'conversation.session.header.actions',
    () => ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'grok-bot-panel',
      // After the shipped header entries; nothing else follows.
      order: 30,
      locale: 'grok',
      inject: () => ({ bot, runs, approvals, active }),
    }, GrokPanel),
  )
}