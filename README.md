# ILLUVRSE — Theater Party Venue

Code-based theater parties: host drops a YouTube or MP3 link, gets a party code, guests join with that code, pick seats, and the room runs synced playback, chat, and reactions.

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- Prisma + PostgreSQL
- Socket.IO for realtime (seats, chat, reactions, playback sync)

## Requirements
- Node 18+
- PostgreSQL

## Setup
1. Install deps  
   ```bash
   npm install
   ```
2. Env vars  
   Copy `.env.example` to `.env` and set:
- `DATABASE_URL` (Postgres connection, e.g., `postgresql://storysphere:storysphere@localhost:5432/illuvrse`)
- `NEXT_PUBLIC_BASE_URL` (e.g., `http://localhost:3000`)
- `NEXT_PUBLIC_SOCKET_URL` (leave blank to use same origin)
- `OPENAI_API_KEY` (server-side preferred for MemeMachine)
- `CONTROL_ENABLED` (set `true` to unlock /control settings page; defaults to false)
3. Prisma  
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   npx prisma db seed
   ```
4. Dev server  
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 (or another port if 3000 is already in use)

## Production build
```bash
npm run build
npm start
```

## Routes
- `/` — landing with Host/Join CTA + live public parties
- `/host` — create party (title, YouTube/MP3 link, visibility, seats, theme) → generates code and host seat
- `/join` — enter code + display name
- `/party/[code]/seat` — seating chart (real-time taken seats). Reserves seat then routes to room.
- `/party/[code]` — party room (player, chat, reactions, presence). Guests are synced to host playback.
- `/party/[code]/host` — host controls (play/pause/seek sync, end party, copy/share code)

## Core realtime events
- `party:join`, `party:leave`
- `seat:reserve` (broadcast after successful seat reservation)
- `chat:message`
- `reaction:send`
- `playback:state` (host authoritative)
- `playback:requestSync` (guest asks for latest state)

## Database models (Prisma)
- Party (code, title, contentType, contentUrl, visibility, maxSeats, theme, status)
- Participant (displayName, seatId, isHost, joinedAt/leftAt, partyId)
- Message (text, seatId, displayName, partyId, participantId?)
- PlaybackState (playing, currentTime, partyId)

## Seeding
`npx prisma db seed` creates three public sample parties:
- Midnight Cult Classics (YouTube)
- Karaoke Chaos Live (YouTube)
- Lo-fi Afterparty (MP3)

## Notes
- Parties default to private; host must pick public explicitly.
- Chat is rate-limited server-side (1 msg/sec per socket) and trimmed to 200 chars; messages stored server-side.
- Seat IDs are `Row-Number` and double-booking is blocked transactionally.
- Host-only playback controls; guests auto-sync to the host state via Socket.IO. When host ends a party it becomes read-only.

## Control page
- `/control` is locked unless `CONTROL_ENABLED=true` (or in dev).
- OpenAI key entered there stays in browser localStorage only; not persisted.
- MemeMachine defaults, client cooldown, and local rate limits are configurable per device.

## Verification (executed)
- `npm install`
- `npx prisma generate`
- `npx prisma migrate dev --name init`
- `npx prisma db seed`
- `npm run dev -- --hostname 127.0.0.1 --port 3050` (smoke-tested with `curl http://127.0.0.1:3050`)
- `npm run build`
