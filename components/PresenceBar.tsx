type Participant = { seatId: string; displayName: string; isHost: boolean };

type Props = {
  maxSeats: number;
  participants: Participant[];
  seatId?: string;
};

export function PresenceBar({ maxSeats, participants, seatId }: Props) {
  if (participants.length === 0) return null;
  return (
    <div className="glass border-brand-primary/30 px-4 py-3 flex items-center justify-between">
      <div className="text-sm text-white/80">
        In room: {participants.length}/{maxSeats}
      </div>
      <div className="flex gap-2 flex-wrap text-xs font-mono">
        {participants.map((p) => (
          <span
            key={p.seatId}
            className={`px-3 py-1 rounded-full border ${
              p.isHost
                ? 'border-brand-gold bg-brand-gold/10 text-brand-gold font-semibold'
                : p.seatId === seatId
                ? 'border-brand-glow bg-brand-glow/10 text-white shadow-glow'
                : 'border-brand-primary/30 bg-black/30 text-white/80'
            }`}
          >
            {p.isHost ? 'HOST • ' : ''}
            {p.seatId} — {p.displayName}
          </span>
        ))}
      </div>
    </div>
  );
}
