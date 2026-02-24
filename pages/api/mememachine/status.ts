import type { NextApiRequest, NextApiResponse } from 'next';
import { getPrisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const jobId = String(req.query.jobId || '');
  if (!jobId) return res.status(400).json({ error: 'jobId required' });
  const prisma = getPrisma();
  const job = await prisma.memeJob.findUnique({ where: { jobId }, include: { result: true } });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.status(200).json({ jobId: job.jobId, status: job.status, attempts: job.attempts, error: job.error, result: job.result });
}
