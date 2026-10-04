import { weekdayOf, type DayRange, type VisitAggregate } from "./aggregate";

export type Rhythm = {
  /** Average visits per weekday, Monday first. */
  weekdays: number[];
  /** Average visits per local hour, 00 first. */
  hours: number[];
  peakWeekday: number;
  quietestWeekday: number;
  peakHour: number;
};

function indexOfMax(values: number[]): number {
  return values.reduce(
    (best, value, i) => (value > values[best] ? i : best),
    0,
  );
}

function indexOfMin(values: number[], include: (i: number) => boolean) {
  let best = -1;
  for (const [i, value] of values.entries()) {
    if (include(i) && (best === -1 || value < values[best])) best = i;
  }
  return best;
}

/**
 * Averages visits per weekday and hour over every calendar day in the range,
 * including days without visits, so quiet days lower the average too.
 */
export function buildRhythm({ grid }: VisitAggregate, range: DayRange): Rhythm {
  const occurrences = Array<number>(7).fill(0);
  for (let day = range.start; day <= range.end; day++) {
    occurrences[weekdayOf(day)]++;
  }

  const weekdays = grid.map((hours, weekday) => {
    const visits = hours.reduce((sum, count) => sum + count, 0);
    return occurrences[weekday] ? visits / occurrences[weekday] : 0;
  });
  const hours = Array.from(
    { length: 24 },
    (_, hour) =>
      grid.reduce((sum, weekday) => sum + weekday[hour], 0) / range.days,
  );

  return {
    weekdays,
    hours,
    peakWeekday: indexOfMax(weekdays),
    // A range shorter than a week lacks some weekdays; they are not quiet.
    quietestWeekday: indexOfMin(weekdays, (i) => occurrences[i] > 0),
    peakHour: indexOfMax(hours),
  };
}

/** Visits per calendar day in the range, oldest first, including empty days. */
export function buildDailyVisits(
  { days }: VisitAggregate,
  range: DayRange,
): number[] {
  return Array.from(
    { length: range.days },
    (_, offset) => days.get(range.start + offset) ?? 0,
  );
}
