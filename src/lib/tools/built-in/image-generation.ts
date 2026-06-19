/**
 * Built-in image-generation tool (§8.2).
 *
 * @module
 */
import type { JSONSchema, ToolContext, ToolDefinition } from '@/lib/interfaces'
import { notWiredYet } from './guards'

/** Arguments accepted by {@link ImageGenerationTool}. */
export interface ImageGenerationInput {
  /** Text description of the image to generate. */
  prompt: string
  /** Requested output size, e.g. `1024x1024`. */
  size?: string
}

/** A generated image. */
export interface ImageGenerationResult {
  /** Base64-encoded PNG of the generated image. */
  image: string
}

/** Generate an image from a text prompt. */
export class ImageGenerationTool
  implements ToolDefinition<ImageGenerationInput, ImageGenerationResult>
{
  readonly name = 'image_generation'
  readonly description = 'Generate an image from a text prompt.'
  readonly source = 'built-in' as const
  readonly version = '1.0.0'

  readonly inputSchema: JSONSchema<ImageGenerationInput> = {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Text description of the image.' },
      size: { type: 'string', description: 'Output size, e.g. "1024x1024".' },
    },
    required: ['prompt'],
  }

  async execute(
    input: ImageGenerationInput,
    context: ToolContext,
  ): Promise<ImageGenerationResult> {
    void input
    void context
    throw notWiredYet(this.name)
  }
}
