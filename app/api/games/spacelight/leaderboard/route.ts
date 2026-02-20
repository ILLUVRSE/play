import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const leaderboard = await prisma.leaderboard.findMany({
      orderBy: { score: 'desc' },
      take: 20,
    });
    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
