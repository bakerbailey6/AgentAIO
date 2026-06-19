/**
 * A Vercel AI SDK {@link LanguageModelV2} that produces text by shelling out to
 * a provider CLI (`claude` / `codex`) signed into the user's subscription.
 *
 * This is the bridge that lets subscription models flow through the *existing*
 * stack unchanged: the `claude-cli` / `codex-cli` providers return one of these
 * from `createAdapter`, the {@link LLMRouter} hands it to `streamText`, and an
 * ordinary LLM chat card renders the result — no separate agent type. All
 * child-process I/O is delegated to {@link streamCliText}; this class only maps
 * its text deltas onto the V2 stream-part protocol
 * (`stream-start → text-start → text-delta* → text-end → finish`).
 *
 * Token usage is reported as `undefined` — the CLIs do not expose per-call token
 * counts in a stable way, and subscription usage is flat-rate rather than
 * metered per token.
 *
 * @module
 */
import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2Prompt,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
} from '@ai-sdk/provider'
import { streamCliText, type CliKind } from './cli-invoke'

const TEXT_BLOCK_ID = 'cli-text'
const UNKNOWN_USAGE: LanguageModelV2Usage = {
  inputTokens: undefined,
  outputTokens: undefined,
  totalTokens: undefined,
}

export class CliLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2' as const
  readonly provider: string
  readonly modelId: string
  readonly supportedUrls: Record<string, RegExp[]> = {}

  constructor(
    private readonly kind: CliKind,
    modelId: string,
    provider: string,
  ) {
    this.modelId = modelId
    this.provider = provider
  }

  /** Collapse the structured prompt into the single text blob the CLIs accept. */
  private flattenPrompt(prompt: LanguageModelV2Prompt): string {
    const parts: string[] = []
    for (const message of prompt) {
      if (message.role === 'system') {
        parts.push(message.content)
      } else if (message.role === 'user' || message.role === 'assistant') {
        for (const part of message.content) {
          if (part.type === 'text') parts.push(part.text)
        }
      }
      // tool messages / non-text parts are dropped — the CLIs take plain text
    }
    return parts.join('\n\n')
  }

  async doStream(
    options: LanguageModelV2CallOptions,
  ): Promise<{ stream: ReadableStream<LanguageModelV2StreamPart> }> {
    const prompt = this.flattenPrompt(options.prompt)
    const kind = this.kind
    const modelName = this.modelId

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] })
        controller.enqueue({ type: 'text-start', id: TEXT_BLOCK_ID })
        try {
          for await (const delta of streamCliText({ kind, prompt, modelName })) {
            controller.enqueue({ type: 'text-delta', id: TEXT_BLOCK_ID, delta })
          }
          controller.enqueue({ type: 'text-end', id: TEXT_BLOCK_ID })
          controller.enqueue({ type: 'finish', finishReason: 'stop', usage: UNKNOWN_USAGE })
        } catch (err) {
          controller.enqueue({ type: 'error', error: err })
          controller.enqueue({ type: 'finish', finishReason: 'error', usage: UNKNOWN_USAGE })
        } finally {
          controller.close()
        }
      },
    })

    return { stream }
  }

  async doGenerate(options: LanguageModelV2CallOptions): Promise<{
    content: LanguageModelV2Content[]
    finishReason: LanguageModelV2FinishReason
    usage: LanguageModelV2Usage
    warnings: []
  }> {
    const prompt = this.flattenPrompt(options.prompt)
    let text = ''
    for await (const delta of streamCliText({ kind: this.kind, prompt, modelName: this.modelId })) {
      text += delta
    }
    return {
      content: text ? [{ type: 'text', text }] : [],
      finishReason: 'stop',
      usage: UNKNOWN_USAGE,
      warnings: [],
    }
  }
}
