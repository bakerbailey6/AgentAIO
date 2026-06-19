// src/lib/llm/providers/codex-cli.ts
import type { LanguageModel } from 'ai'
import type { LLMProvider, BaseModel, Credentials, ConnectionResult } from '@/lib/interfaces'
import { CliLanguageModel } from '@/lib/llm/cli/cli-language-model'

export interface CodexCliModel extends BaseModel {
  provider: 'codex-cli'
}

/**
 * OpenAI via the user's ChatGPT Plus/Pro subscription, routed through the
 * installed `codex` CLI rather than an API key. {@link createAdapter} returns a
 * {@link CliLanguageModel} that shells out to `codex exec`, so these models work
 * in any ordinary LLM chat card. Desktop-only; needs no credentials — auth lives
 * in the CLI's own `codex login`.
 *
 * The model id is passed to codex's `--model`; confirm the alias against the
 * installed CLI on first run (see PROGRESS.md desktop caveat).
 */
export class CodexCliProvider implements LLMProvider<CodexCliModel> {
  readonly providerId = 'codex-cli'
  readonly displayName = 'Codex (subscription)'
  readonly authType = 'cli' as const

  async listModels(_credentials: Credentials): Promise<CodexCliModel[]> {
    return [
      { id: 'gpt-5-codex', displayName: 'Codex (subscription)', contextWindow: 200000, supportsTools: true, supportsStreaming: true, provider: 'codex-cli' },
    ]
  }

  createAdapter(model: CodexCliModel, _credentials: Credentials): LanguageModel {
    return new CliLanguageModel('codex', model.id, this.providerId) as unknown as LanguageModel
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
