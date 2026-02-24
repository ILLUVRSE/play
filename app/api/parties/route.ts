import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { detectContentType, hostSchema } from '@/lib/validation';
import { generatePartyCode } from '@/lib/code';
import { bestHostSeat } from '@/lib/seatMap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const prisma = getPrisma();
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
  const prisma = getPrisma();
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

  const playlistInput = Array.isArray(body.playlist) ? body.playlist : [];
  const normalizedPlaylist = playlistInput
    .map((item: { contentUrl?: string; title?: string }) => ({
      contentUrl: typeof item?.contentUrl === 'string' ? item.contentUrl.trim() : '',
      title: typeof item?.title === 'string' ? item.title.trim() : ''
    }))
    .filter((item: { contentUrl: string }) => item.contentUrl.length > 0);

  const playlist =
    normalizedPlaylist.length > 0
      ? normalizedPlaylist.map((item: { contentUrl: string; title: string }) => {
          const contentType = detectContentType(item.contentUrl);
          return contentType ? { ...item, contentType } : null;
        })
      : null;

  if (playlist && playlist.some((item: { contentType: string } | null) => !item)) {
    return NextResponse.json({ error: 'Content must be a YouTube, MP3, or MP4 link' }, { status: 400 });
  }

  const fallbackType = detectContentType(parsed.data.contentUrl || "");
  if (!playlist?.length && !fallbackType) {
    return NextResponse.json({ error: 'Content must be a YouTube, MP3, or MP4 link' }, { status: 400 });
  }
  const firstItem = playlist?.[0] || (fallbackType ? { contentUrl: parsed.data.contentUrl, contentType: fallbackType, title: '' } : null);
  if (!firstItem) {
    return NextResponse.json({ error: 'Playlist must include at least one media item' }, { status: 400 });
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
      contentType: firstItem.contentType,
      contentUrl: firstItem.contentUrl,
      visibility: parsed.data.visibility,
      maxSeats: parsed.data.maxSeats,
      theme: parsed.data.theme,
      playlist: {
        create: (playlist?.length ? playlist : [firstItem]).map((item: { contentType: string; contentUrl: string; title?: string }, index: number) => ({
          orderIndex: index,
          contentType: item.contentType,
          contentUrl: item.contentUrl,
          title: item.title || null
        }))
      },
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
