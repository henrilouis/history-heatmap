export function toLocalZonedDateTime(
  timestamp: number,
  timeZone = Temporal.Now.timeZoneId(),
): Temporal.ZonedDateTime {
  // Chrome timestamps can contain fractional milliseconds. Match Date's
  // truncation at this boundary; retain the original number for visit sorting.
  return Temporal.Instant.fromEpochMilliseconds(
    Math.trunc(timestamp),
  ).toZonedDateTimeISO(timeZone);
}

export function createLocalTimeKeyer(timeZone = Temporal.Now.timeZoneId()) {
  let cached:
    | Readonly<{ start: number; end: number; day: string; hour: string }>
    | undefined;

  // Results are shared on cache hits and replaced, never mutated, on misses.
  // Callers may retain a result, but must treat it as read-only.
  return (timestamp: number): Readonly<{ day: string; hour: string }> => {
    const milliseconds = Math.trunc(timestamp);
    if (cached && milliseconds >= cached.start && milliseconds < cached.end) {
      return cached;
    }

    const zoned = toLocalZonedDateTime(milliseconds, timeZone);
    const local = zoned.toPlainDateTime();
    // History is normally newest-first. Reuse keys within this local hour,
    // avoiding a timezone conversion for every visit. Keep only one interval
    // per grouping operation; unsorted input simply recomputes on a cache miss.
    const hourStart =
      milliseconds -
      (local.minute * 60_000 + local.second * 1_000 + local.millisecond);
    // An offset change can split an hour (e.g. Lord Howe's 30-minute DST shift).
    // Clip both ends to transitions so reuse is safe in either input direction.
    // Advance 1 ns to include a transition exactly at the visit timestamp.
    const previous = zoned
      .add({ nanoseconds: 1 })
      .getTimeZoneTransition("previous");
    const next = zoned.getTimeZoneTransition("next");
    cached = {
      start: Math.max(hourStart, previous?.epochMilliseconds ?? -Infinity),
      end: Math.min(hourStart + 3_600_000, next?.epochMilliseconds ?? Infinity),
      day: local.toPlainDate().toString(),
      hour: String(local.hour).padStart(2, "0"),
    };
    return cached;
  };
}

export function* eachCalendarDate(
  start: Temporal.PlainDate,
  end: Temporal.PlainDate,
): Generator<Temporal.PlainDate> {
  for (
    let current = start;
    Temporal.PlainDate.compare(current, end) <= 0;
    current = current.add({ days: 1 })
  ) {
    yield current;
  }
}
