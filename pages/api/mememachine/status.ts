import type { NextApiRequest, NextApiResponse } from 'next';
import { getPrisma } from '../../../lib/prisma';
import type { MemeErrorResponse, MemeStatusResponse } from '../../../types/games';

export default async function handler(req: NextApiRequest, res: NextApiResponse<MemeStatusResponse | MemeErrorResponse>) {
  const jobId = String(req.query.jobId || '');
  if (!jobId) return res.status(400).json({ error: 'jobId required' });
  const prisma = getPrisma();
  const job = await prisma.memeJob.findUnique({ where: { jobId }, include: { result: true } });
  if (!job) return res.status(404).json({ error: 'Job not found' });

  return res.status(200).json({
    jobId: job.jobId,
    status: job.status as MemeStatusResponse['status'],
    attempts: job.attempts,
    error: job.error,
    result: job.result
      ? {
          b64_png: job.result.b64_png,
          s3Key: job.result.s3Key,
          width: job.result.width,
          height: job.result.height,
          aspect: job.result.aspect as '1:1' | '4:5' | '16:9'
        }
      : null
  });
}
