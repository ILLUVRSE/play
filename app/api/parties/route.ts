import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { detectContentType, hostSchema } from '@/lib/validation';
import { generatePartyCode } from '@/lib/code';
import { bestHostSeat } from '@/lib/seatMap';

export async function GET() {
  const parties = await prisma.party.findMany({
    where: { visibility: 'public', status: 'live' },
    take: 8,
    orderBy: { createdAt: 'desc' },
    include: {
      participants: {
        where: { leftAt: null },
        select: { id: true }
      }
    }
  });
  return NextResponse.json(
    parties.map((p) => ({
      code: p.code,
      title: p.title,
      theme: p.theme,
      maxSeats: p.maxSeats,
      seatsTaken: p.participants.length
    }))
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = hostSchema.safeParse({
    title: body.title,
    contentUrl: body.contentUrl,
    visibility: body.visibility ?? 'private',
    maxSeats: Number(body.maxSeats),
    theme: body.theme
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const contentType = detectContentType(parsed.data.contentUrl);
  if (!contentType) {
    return NextResponse.json({ error: 'Content must be a YouTube or MP3 link' }, { status: 400 });
  }

  let code = generatePartyCode();
  let existing = await prisma.party.findUnique({ where: { code } });
  while (existing) {
    code = generatePartyCode();
    existing = await prisma.party.findUnique({ where: { code } });
  }

  const hostSeat = bestHostSeat(parsed.data.maxSeats);

  const party = await prisma.party.create({
    data: {
      code,
      title: parsed.data.title,
      contentType,
      contentUrl: parsed.data.contentUrl,
      visibility: parsed.data.visibility,
      maxSeats: parsed.data.maxSeats,
      theme: parsed.data.theme,
      participants: {
        create: {
          displayName: 'Host',
          seatId: hostSeat,
          isHost: true
        }
      },
      playback: {
        create: {
          playing: false,
          currentTime: 0
        }
      }
    },
    include: {
      participants: true
    }
  });

  return NextResponse.json({
    code,
    partyId: party.id,
    hostSeat,
    participantId: party.participants[0]?.id
  });
}
