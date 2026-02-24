import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { getPrisma } from '@/lib/prisma';
import { memeInputHash } from '@/lib/gameManager';

const rateMap = new Map<string, { count: number; last: number }>();
const WINDOW = 5000;
const BURST = 3;

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

function validate(req: NextApiRequest) {
  const { idea = '', topText = '', bottomText = '', style = 'clean', aspect = '1:1' } = req.body || {};
  const cleanIdea = String(idea).trim();
  const top = String(topText).trim();
  const bottom = String(bottomText).trim();
  const aspectKey = aspect === '4:5' || aspect === '16:9' ? aspect : '1:1';
  if (cleanIdea.length < 3 || cleanIdea.length > 400) throw new Error('Idea must be 3-400 characters');
  if (top.length > 80 || bottom.length > 80) throw new Error('Top/Bottom text max 80 chars');
  return { cleanIdea, top, bottom, style: String(style || 'clean'), aspectKey };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'local';
  const now = Date.now();
  const entry = rateMap.get(ip) ?? { count: 0, last: now };
  const elapsed = now - entry.last;
  const count = elapsed > WINDOW ? 1 : entry.count + 1;
  if (elapsed <= WINDOW && count > BURST) return res.status(429).json({ error: 'Too many requests, slow down' });
  rateMap.set(ip, { count, last: now });

  const prisma = getPrisma();
  try {
    const { cleanIdea, top, bottom, style, aspectKey } = validate(req);
    const hash = memeInputHash({ idea: cleanIdea, topText: top, bottomText: bottom, style, aspect: aspectKey });
    const cached = await prisma.memeCache.findUnique({ where: { inputHash: hash } });
    if (cached) return res.status(200).json({ b64_png: cached.b64_png, width: cached.width, height: cached.height, aspect: cached.aspect, cached: true });

    const serverKey = process.env.OPENAI_API_KEY;
    const headerKey = typeof req.headers['x-openai-key'] === 'string' ? req.headers['x-openai-key'].trim() : '';
    const effectiveKey = serverKey || headerKey;
    if (!effectiveKey) return res.status(400).json({ error: 'No OpenAI key configured. Add OPENAI_API_KEY on server or set it in /control.' });

    const size = aspectKey === '4:5' ? '1024x1792' : aspectKey === '16:9' ? '1792x1024' : '1024x1024';
    const width = aspectKey === '16:9' ? 1792 : 1024;
    const height = aspectKey === '4:5' ? 1792 : 1024;
    const prompt = `Create a meme image in ${style} style. Concept: ${cleanIdea}. ${top ? `Top text: ${top}.` : ''} ${bottom ? `Bottom text: ${bottom}.` : ''}`;
    const client = new OpenAI({ apiKey: effectiveKey });
    const image = await client.images.generate({ model: 'gpt-image-1', prompt, size });
    const b64_png = image.data?.[0]?.b64_json;
    if (!b64_png) return res.status(500).json({ error: 'Failed to generate image' });
    await prisma.memeCache.create({ data: { inputHash: hash, b64_png, width, height, aspect: aspectKey } });
    return res.status(200).json({ b64_png, width, height, aspect: aspectKey, cached: false });
  } catch (e: any) {
    return res.status(400).json({ error: e.message || 'Unable to generate meme' });
  }
}
