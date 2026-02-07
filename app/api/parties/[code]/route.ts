import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { partyCodeSchema } from '@/lib/validation';
import { buildSeatMap } from '@/lib/seatMap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { code: string } };

export async function GET(_req: Request, { params }: Params) {
  const codeResult = partyCodeSchema.safeParse(params.code);
  if (!codeResult.success) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  const party = await prisma.party.findUnique({
    where: { code: codeResult.data },
    include: {
      participants: {
        where: { leftAt: null },
        select: { id: true, seatId: true, displayName: true, isHost: true }
      },
      playback: true
    }
  });

  if (!party) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 });
  }

  const seatMap = buildSeatMap(party.maxSeats);

  return NextResponse.json({
    code: party.code,
    title: party.title,
    contentType: party.contentType,
    contentUrl: party.contentUrl,
    theme: party.theme,
    visibility: party.visibility,
    maxSeats: party.maxSeats,
    status: party.status,
    seatMap,
    participants: party.participants,
    playback: party.playback
  });
}
