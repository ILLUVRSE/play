import assert from 'assert';
import type { NextApiRequest, NextApiResponse } from 'next';
import generateCached from '../../pages/api/mememachine/generate_cached';
import generateAsync from '../../pages/api/mememachine/generate_async';
import { getPrisma } from '../../lib/prisma';
import { memeInputHash } from '../../lib/gameManager';

if (!process.env.DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.log('Skipping mememachine test: DATABASE_URL is not set');
  process.exit(0);
}

function createRes() {
  const out: { statusCode: number; body: any } = { statusCode: 200, body: null };
  const res = {
    status(code: number) {
      out.statusCode = code;
      return this;
    },
    json(payload: any) {
      out.body = payload;
      return this;
    }
  } as unknown as NextApiResponse;
  return { out, res };
}

async function main() {
  process.env.TEST_OPENAI_MOCK = 'true';
  const prisma = getPrisma();
  await prisma.memeJob.deleteMany();
  await prisma.memeCache.deleteMany();

  const hash = memeInputHash({ idea: 'cached meme' });
  await prisma.memeCache.create({ data: { inputHash: hash, b64_png: 'abc123', width: 1, height: 1, aspect: '1:1' } });

  {
    const req = {
      method: 'POST',
      body: { idea: 'cached meme' },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' }
    } as unknown as NextApiRequest;
    const { out, res } = createRes();
    await generateCached(req, res);
    assert.equal(out.statusCode, 200);
    assert.equal(out.body.cached, true);
    assert.equal(out.body.b64_png, 'abc123');
  }

  {
    delete process.env.OPENAI_API_KEY;
    const req = {
      method: 'POST',
      body: { idea: 'async not allowed' },
      headers: { 'x-openai-key': 'sk-client-only' }
    } as unknown as NextApiRequest;
    const { out, res } = createRes();
    await generateAsync(req, res);
    assert.equal(out.statusCode, 422);
    assert.ok(String(out.body.error).includes('Cannot enqueue async'));
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
