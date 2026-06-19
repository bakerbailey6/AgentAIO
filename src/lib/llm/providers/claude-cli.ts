// src/lib/llm/providers/claude-cli.ts
import type { LanguageModel } from 'ai'
import type { LLMProvider, BaseModel, Credentials, ConnectionResult } from '@/lib/interfaces'
import { CliLanguageModel } from '@/lib/llm/cli/cli-language-model'

export interface ClaudeCliModel extends BaseModel {
  provider: 'claude-cli'
}

/**
 * Anthropic Claude via the user's Claude Pro/Max subscription, routed through
 * the installed `claude` CLI rather than an API key. {@link createAdapter}
 * returns a {@link CliLanguageModel} that shells out to `claude -p`, so these
 * models work in any ordinary LLM chat card. Desktop-only (the CLI runs as a
 * child process); needs no credentials — auth lives in the CLI's own login.
 *
 * Model ids are Claude Code `--model` aliases; confirm against the installed CLI
 * on first run (see PROGRESS.md desktop caveat).
 */
export class ClaudeCliProvider implements LLMProvider<ClaudeCliModel> {
  readonly providerId = 'claude-cli'
  readonly displayName = 'Claude (subscription)'
  readonly authType = 'cli' as const

  async listModels(_credentials: Credentials): Promise<ClaudeCliModel[]> {
    return [
      { id: 'sonnet', displayName: 'Claude Sonnet (subscription)', contextWindow: 200000, supportsTools: true, supportsStreaming: true, provider: 'claude-cli' },
      { id: 'opus', displayName: 'Claude Opus (subscription)', contextWindow: 200000, supportsTools: true, supportsStreaming: true, provider: 'claude-cli' },
    ]
  }

  createAdapter(model: ClaudeCliModel, _credentials: Credentials): LanguageModel {
    return new CliLanguageModel('claude', model.id, this.providerId) as unknown as LanguageModel
  }

  async testConnection(credentials: Credentials): Promise<ConnectionResult> {
    const start = Date.now()
    try {
      await this.listModels(credentials)
      return { success: true, latencyMs: Date.now() - start }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
