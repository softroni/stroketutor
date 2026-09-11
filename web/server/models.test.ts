import { describe, expect, it } from 'vitest'

import { selectVisionModels } from './models'

const model = (id: string, input: string[], output: string[] | undefined, parameters = ['structured_outputs']) => ({
  id,
  architecture: { input_modalities: input, output_modalities: output },
  supported_parameters: parameters,
})

describe('selectVisionModels', () => {
  it('offers models that read images, answer in text and honour structured output', () => {
    const ids = selectVisionModels([
      model('vendor/vision', ['text', 'image'], ['text']),
      model('vendor/unlisted-output', ['image'], undefined),
      model('google/gemini-2.5-flash-image', ['image', 'text'], ['image', 'text']),
      model('vendor/text-only', ['text'], ['text']),
      model('vendor/no-schema', ['image'], ['text'], ['max_tokens']),
    ]).map((candidate) => candidate.id)
    expect(ids).toEqual(['vendor/unlisted-output', 'vendor/vision'])
  })
})
