// @ts-nocheck
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import { chromium } from 'playwright';
import { getPrisma } from '../../lib/prisma';
import { memeInputHash } from '../../lib/gameManager';

async function waitForServer(url: string, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Server did not become ready in time');
}

async function run() {
  process.env.TEST_OPENAI_MOCK = 'true';
  mkdirSync('tests/e2e/artifacts', { recursive: true });

  const prisma = getPrisma();
  const hash = memeInputHash({ idea: 'smoke cache' });
  await prisma.memeCache.upsert({
    where: { inputHash: hash },
    create: { inputHash: hash, b64_png: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAn0B9oG2HRAAAAAASUVORK5CYII=', width: 1, height: 1, aspect: '1:1' },
    update: {}
  });

  const env = { ...process.env, TEST_OPENAI_MOCK: 'true', REDIS_URL: '', REDIS_HOST: '' };
  const dev = spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', '3070'], { env, stdio: 'inherit' });
  const worker = spawn('npx', ['ts-node', 'workers/mememachine.worker.ts'], { env, stdio: 'inherit' });

  try {
    await waitForServer('http://127.0.0.1:3070/host', 30000);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:3070/host', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.screenshot({ path: 'tests/e2e/artifacts/host.png', fullPage: true });
    await browser.close();
  } finally {
    worker.kill('SIGTERM');
    dev.kill('SIGTERM');
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
