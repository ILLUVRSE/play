import { z } from 'zod';

export const partyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, 'Party code must be 6 alphanumeric characters');

export const displayNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .transform((v) => v.replace(/(fuck|shit|bitch)/gi, '—'));

const youtubeRegex =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w\-]{6,}/i;

export const hostSchema = z.object({
  title: z.string().trim().min(2).max(120),
  contentUrl: z.string().trim(),
  visibility: z.enum(['private', 'public']).default('private'),
  maxSeats: z.number().int().min(12).max(48),
  theme: z.string().trim().max(40).optional()
});

// Allow youtube | mp3 | mp4
export type HostPayload = z.infer<typeof hostSchema> & { contentType: 'youtube' | 'mp3' | 'mp4' };

/**
 * Detect content type from a URL:
 * - YouTube -> 'youtube'
 * - .mp3 -> 'mp3'
 * - .mp4 -> 'mp4'
 * Returns null if unknown.
 */
export function detectContentType(url: string): 'youtube' | 'mp3' | 'mp4' | null {
  if (!url || typeof url !== 'string') return null;
  if (youtubeRegex.test(url)) return 'youtube';
  const lower = url.toLowerCase();
  if (lower.includes('.mp3')) return 'mp3';
  if (lower.includes('.mp4')) return 'mp4';
  return null;
}
