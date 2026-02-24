import { PrismaClient } from '@prisma/client';
import { generatePartyCode } from '../lib/code';
import { bestHostSeat } from '../lib/seatMap';

const prisma = new PrismaClient();

async function main() {
  await prisma.message.deleteMany({});
  await prisma.participant.deleteMany({});
  await prisma.playbackState.deleteMany({});
  await prisma.playerScore.deleteMany({});
  await prisma.gameSession.deleteMany({});
  await prisma.game.deleteMany({});
  await prisma.memeJob.deleteMany({});
  await prisma.memeCache.deleteMany({});
  await prisma.party.deleteMany({});

  const seeds = [
    {
      title: 'Midnight Cult Classics',
      contentType: 'youtube' as const,
      contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      visibility: 'public',
      maxSeats: 24,
      theme: 'Cult Horror'
    },
    {
      title: 'Karaoke Chaos Live',
      contentType: 'youtube' as const,
      contentUrl: 'https://www.youtube.com/watch?v=Zi_XLOBDo_Y',
      visibility: 'public',
      maxSeats: 48,
      theme: 'Karaoke'
    },
    {
      title: 'Lo-fi Afterparty',
      contentType: 'mp3' as const,
      contentUrl: 'https://cdn.pixabay.com/download/audio/2021/09/25/audio_a7d7a4e5f2.mp3',
      visibility: 'public',
      maxSeats: 12,
      theme: 'Chill'
    }
  ];


  await prisma.game.createMany({
    data: [
      { slug: 'forehead-poker', name: 'Forehead Poker', description: '3-card social poker with hidden self cards' },
      { slug: 'caption-battle', name: 'Caption Battle', description: 'Write and vote captions on memes' },
      { slug: 'pictionary', name: 'Pictionary', description: 'Draw and guess in real-time' }
    ],
    skipDuplicates: true
  });

  for (const seed of seeds) {
    let code = generatePartyCode();
    const seat = bestHostSeat(seed.maxSeats);
    await prisma.party.create({
      data: {
        code,
        title: seed.title,
        contentType: seed.contentType,
        contentUrl: seed.contentUrl,
        visibility: seed.visibility,
        maxSeats: seed.maxSeats,
        theme: seed.theme,
        participants: {
          create: { displayName: 'Host', seatId: seat, isHost: true }
        },
        playback: { create: { playing: false, currentTime: 0 } },
        playlist: {
          create: [
            {
              orderIndex: 0,
              contentType: seed.contentType,
              contentUrl: seed.contentUrl,
              title: seed.title
            }
          ]
        }
      }
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
