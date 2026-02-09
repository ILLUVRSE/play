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

  const party = await prisma.party.findUnique({
    where: { code: codeResult.data },
    include: { playback: true }
  });

  if (!party || !party.playback) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 });
  }

  return NextResponse.json({ ...party.playback, currentIndex: party.currentIndex });
}

export async function POST(req: Request, { params }: Params) {
  const prisma = getPrisma();
  const codeResult = partyCodeSchema.safeParse(params.code);
  if (!codeResult.success) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  const body = await req.json();
  const party = await prisma.party.findUnique({ where: { code: codeResult.data } });
  if (!party) return NextResponse.json({ error: 'Party not found' }, { status: 404 });

  const participantId = typeof body.participantId === 'string' ? body.participantId : '';
  if (!participantId) {
    return NextResponse.json({ error: 'Host authorization required' }, { status: 401 });
  }
  const host = await prisma.participant.findFirst({
    where: { id: participantId, partyId: party.id, isHost: true, leftAt: null }
  });
  if (!host) {
    return NextResponse.json({ error: 'Host authorization required' }, { status: 401 });
  }

  const playing = Boolean(body.playing);
  const currentTime = Number(body.currentTime || 0);
  const currentIndex = Number(body.currentIndex || 0);

  const updated = await prisma.playbackState.upsert({
    where: { partyId: party.id },
    update: { playing, currentTime },
    create: { partyId: party.id, playing, currentTime }
  });
  await prisma.party.update({
    where: { id: party.id },
    data: { currentIndex }
  });

  return NextResponse.json({ ...updated, currentIndex });
}
