import React from 'react';

type Props = {
  seats: string[];
  taken: Set<string>;
  occupied?: Record<string, { displayName: string; initials: string }>;
  selected?: string;
  onSelect?: (seatId: string) => void;
};

export function SeatGrid({ seats, taken, occupied, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 mt-3">
      {seats.map((seat) => {
        const isTaken = taken.has(seat);
        const isSelected = selected === seat;
        const occupant = occupied?.[seat];
        return (
          <button
            key={seat}
            type="button"
            disabled={isTaken}
            onClick={() => onSelect?.(seat)}
            aria-label={
              isTaken
                ? `${seat} occupied${occupant ? ` by ${occupant.displayName}` : ''}`
                : `Select seat ${seat}`
            }
            className={`rounded-xl border px-2 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow ${
              isTaken
                ? 'border-brand-primaryDark/60 bg-brand-primaryDark/30 text-white/50 cursor-not-allowed'
                : isSelected
                ? 'border-brand-glow bg-brand-glow/10 text-white shadow-[0_0_0_2px_rgba(127,255,212,0.5)] animate-pulse'
                : 'border-brand-primary/30 bg-black/30 hover:border-brand-glow/60 hover:shadow-glow'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs uppercase tracking-wide">{seat}</div>
              {isTaken && occupant ? (
                <div className="h-6 w-6 rounded-full bg-white/10 border border-white/10 text-[10px] grid place-items-center">
                  {occupant.initials}
                </div>
              ) : isTaken ? (
                <div className="text-[10px] text-white/50">taken</div>
              ) : (
                <div className="text-[10px] text-white/60">free</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
