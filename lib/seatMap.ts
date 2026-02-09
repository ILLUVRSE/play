export type SeatMap = { rows: number; cols: number; seats: string[] };

export function buildSeatMap(maxSeats: number): SeatMap {
  let rows = 3;
  let cols = 4;
  if (maxSeats === 6) {
    rows = 2;
    cols = 3;
  } else if (maxSeats === 24) {
    rows = 4;
    cols = 6;
  } else if (maxSeats === 48) {
    rows = 6;
    cols = 8;
  }
  const seats: string[] = [];
  for (let r = 0; r < rows; r++) {
    const rowLetter = String.fromCharCode(65 + r);
    for (let c = 1; c <= cols; c++) {
      seats.push(`${rowLetter}-${c}`);
    }
  }
  return { rows, cols, seats };
}

export function bestHostSeat(maxSeats: number): string {
  const map = buildSeatMap(maxSeats);
  return map.seats[0] ?? 'A-1';
}
