# ILLUVRSE — Theater Party Venue

Code-based theater parties: host builds a playlist (YouTube/MP3/MP4), gets a party code, guests join with that code, pick seats, and the room runs synced playback, voice/video, and reactions.

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- Prisma + PostgreSQL
- Socket.IO for realtime (seats, moderation, playback sync)
- LiveKit for voice/video rooms

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
- `NEXT_PUBLIC_LIVEKIT_URL` (LiveKit server URL, e.g., `wss://your-livekit-host`)
- `LIVEKIT_URL` (LiveKit server URL for server-side SDK)
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `OPENAI_API_KEY` (server-side preferred)
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

## Standalone Socket Server (required for production WebSockets)
Vercel serverless routes do not keep WebSocket upgrades open, so run the Socket.IO server separately.

1. Deploy `server/socket-server.js` on Render/Fly/Railway.
2. Set env vars on the socket server:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_BASE_URL` (e.g., `https://www.illuvrse.com`)
   - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
   - `SOCKET_PORT` (optional; defaults to 3001)
3. Set in the Next.js app:
   - `NEXT_PUBLIC_SOCKET_URL` to the socket server URL (e.g., `https://illuvrse-socket.onrender.com`)
4. Start locally:
   ```bash
   npm run socket:dev
   ```

## Routes
- `/` — landing with Host/Join CTA + live public parties
- `/host` — create party (title, playlist, visibility, seats, theme) → generates code and host seat
- `/join` — enter code + display name
- `/party/[code]/seat` — seating chart (real-time taken seats). Reserves seat then routes to room.
- `/party/[code]` — party room (player, voice/video tiles, reactions, presence). Guests are synced to host playback.
- `/party/[code]/host` — host controls (play/pause/seek sync, next/prev, moderation, copy/share code)

## Core realtime events
- `party:join`, `party:leave`
- `seat:reserve` (broadcast after successful seat reservation)
- `reaction:send`
- `playback:state` (host authoritative)
- `playback:requestSync` (guest asks for latest state)
- `host:mute`, `host:unmute`, `host:kick`, `host:micLock`, `host:seatLock`
- `voice:join` (LiveKit token handoff)

## Database models (Prisma)
- Party (code, title, visibility, maxSeats, theme, currentIndex, micLocked, seatLocked, status)
- Participant (displayName, seatId, isHost, muted, joinedAt/leftAt, partyId)
- PlaylistItem (partyId, orderIndex, contentType, contentUrl, title)
- PlaybackState (playing, currentTime, partyId)

## Seeding
`npx prisma db seed` creates three public sample parties:
- Midnight Cult Classics (YouTube)
- Karaoke Chaos Live (YouTube)
- Lo-fi Afterparty (MP3)

## Notes
- Parties default to private; host must pick public explicitly.
- Seat IDs are `Row-Number` and double-booking is blocked transactionally.
- Host-only playback controls; guests auto-sync to the host state via Socket.IO. When host ends a party it becomes read-only.
- Voice/video is powered by LiveKit; set LiveKit env vars for local or production use.

## Control page
- `/control` is locked unless `CONTROL_ENABLED=true` (or in dev).
- OpenAI key entered there stays in browser localStorage only; not persisted.
- Client cooldowns and local rate limits are configurable per device.

## Verification (executed)
- `npm install`
- `npx prisma generate`
- `npx prisma migrate dev --name init`
- `npx prisma db seed`
- `npm run dev -- --hostname 127.0.0.1 --port 3050` (smoke-tested with `curl http://127.0.0.1:3050`)
- `npm run build`
