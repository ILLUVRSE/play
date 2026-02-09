import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { buildSeatMap } from '@/lib/seatMap';
import { displayNameSchema, partyCodeSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { code: string } };

export async function POST(req: Request, { params }: Params) {
  const prisma = getPrisma();
  const codeResult = partyCodeSchema.safeParse(params.code);
  if (!codeResult.success) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }
  const body = await req.json();
  const seatId = (body.seatId as string | undefined)?.trim();
  const name = displayNameSchema.safeParse(body.displayName);
  if (!seatId || !name.success) {
    return NextResponse.json({ error: 'Seat and display name required' }, { status: 400 });
  }

  const party = await prisma.party.findUnique({
    where: { code: codeResult.data },
    include: { participants: true }
  });

  if (!party || party.status === 'ended') {
    return NextResponse.json({ error: 'Party not available' }, { status: 404 });
  }
  if (party.seatLocked) {
    return NextResponse.json({ error: 'Seats are locked' }, { status: 403 });
  }

  const map = buildSeatMap(party.maxSeats);
  if (!map.seats.includes(seatId)) {
    return NextResponse.json({ error: 'Seat not in this theater' }, { status: 400 });
  }

  const now = new Date();

  try {
    const participant = await prisma.$transaction(async (tx) => {
      const taken = await tx.participant.findFirst({
        where: { partyId: party.id, seatId, leftAt: null }
      });
      if (taken) {
        throw new Error('seat_taken');
      }
      const created = await tx.participant.create({
        data: {
          partyId: party.id,
          seatId,
          displayName: name.data,
          isHost: false,
          joinedAt: now
        }
      });
      return created;
    });

    return NextResponse.json({ participantId: participant.id, seatId: participant.seatId });
  } catch (err) {
    if (err instanceof Error && err.message === 'seat_taken') {
      return NextResponse.json({ error: 'Seat already taken' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Unable to reserve seat' }, { status: 500 });
  }
}
