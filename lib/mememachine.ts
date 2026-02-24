import OpenAI from 'openai';
import { memeInputHash } from './gameManager';
import type { MemeAspect, MemeGeneratePayload } from '../types/games';

export const ONE_BY_ONE_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAn0B9oG2HRAAAAAASUVORK5CYII=';

export const ASPECT_DIMENSIONS: Record<MemeAspect, { size: '1024x1024' | '1024x1792' | '1792x1024'; width: number; height: number }> = {
  '1:1': { size: '1024x1024', width: 1024, height: 1024 },
  '4:5': { size: '1024x1792', width: 1024, height: 1792 },
  '16:9': { size: '1792x1024', width: 1792, height: 1024 }
};

export type ValidatedMemeInput = {
  cleanIdea: string;
  top: string;
  bottom: string;
  style: string;
  aspect: MemeAspect;
  hash: string;
};

export function validateMemeInput(payload: Partial<MemeGeneratePayload>): ValidatedMemeInput {
  const cleanIdea = String(payload.idea || '').trim();
  const top = String(payload.topText || '').trim();
  const bottom = String(payload.bottomText || '').trim();
  const style = String(payload.style || 'clean').trim().slice(0, 64);
  const aspect = payload.aspect === '4:5' || payload.aspect === '16:9' ? payload.aspect : '1:1';
  if (cleanIdea.length < 3 || cleanIdea.length > 400) throw new Error('Idea must be 3-400 characters');
  if (top.length > 80 || bottom.length > 80) throw new Error('Top/Bottom text max 80 chars');

  const hash = memeInputHash({ idea: cleanIdea, topText: top, bottomText: bottom, style, aspect });
  return { cleanIdea, top, bottom, style, aspect, hash };
}

export function buildPrompt(input: ValidatedMemeInput): string {
  return [
    `Create a meme image in ${input.style} style.`,
    `Concept: ${input.cleanIdea}`,
    input.top ? `Place top text: "${input.top}"` : '',
    input.bottom ? `Place bottom text: "${input.bottom}"` : '',
    'Clear, legible meme text, balanced composition.',
    'Safe content. No hateful, violent, or sexual minors content.',
    'Use simple backgrounds and high contrast text.'
  ]
    .filter(Boolean)
    .join(' ');
}

export function isOpenAiMockEnabled(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.TEST_OPENAI_MOCK === 'true';
}

export async function moderatePrompt(apiKey: string, prompt: string): Promise<void> {
  if (isOpenAiMockEnabled()) return;
  const client = new OpenAI({ apiKey });
  const moderation = await client.moderations.create({ model: 'omni-moderation-latest', input: prompt });
  if (moderation.results?.[0]?.flagged) throw new Error('Generated image failed moderation checks');
}

export async function generateMemeImage(opts: { apiKey: string; prompt: string; aspect: MemeAspect }) {
  const { apiKey, prompt, aspect } = opts;
  const dims = ASPECT_DIMENSIONS[aspect];
  if (isOpenAiMockEnabled()) {
    return { b64_png: ONE_BY_ONE_PNG_B64, width: dims.width, height: dims.height };
  }

  const client = new OpenAI({ apiKey });
  const image = await client.images.generate({ model: 'gpt-image-1', prompt, size: dims.size });
  const b64_png = image.data?.[0]?.b64_json;
  if (!b64_png) throw new Error('Failed to generate image');
  return { b64_png, width: dims.width, height: dims.height };
}
