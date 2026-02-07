import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { partyCodeSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { code: string } };

export async function GET(_req: Request, { params }: Params) {
  const prisma = getPrisma();
  const codeResult = partyCodeSchema.safeParse(params.code);
  if (!codeResult.success) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });

  const party = await prisma.party.findUnique({ where: { code: codeResult.data } });
  if (!party) return NextResponse.json({ error: 'Party not found' }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: { partyId: party.id },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return NextResponse.json(messages.reverse());
}
