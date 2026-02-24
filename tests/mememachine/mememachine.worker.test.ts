import assert from 'assert';
import { getPrisma } from '../../lib/prisma';
import { processJobById } from '../../workers/mememachine.worker';

if (!process.env.DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.log('Skipping mememachine test: DATABASE_URL is not set');
  process.exit(0);
}

async function main() {
  process.env.TEST_OPENAI_MOCK = 'true';
  process.env.OPENAI_API_KEY = 'sk-test-server';

  const prisma = getPrisma();
  await prisma.memeJob.deleteMany();
  await prisma.memeCache.deleteMany();

  const job = await prisma.memeJob.create({
    data: {
      jobId: `job-${Date.now()}`,
      inputHash: `hash-${Date.now()}`,
      status: 'running',
      attempts: 1,
      payload: { idea: 'worker fallback test', aspect: '1:1' }
    }
  });

  await processJobById(job.id);

  const updated = await prisma.memeJob.findUnique({ where: { id: job.id }, include: { result: true } });
  assert.equal(updated?.status, 'succeeded');
  assert.ok(updated?.result);
  assert.ok(updated?.result?.b64_png || updated?.result?.s3Key);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
