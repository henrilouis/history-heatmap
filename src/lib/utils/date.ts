// TODO (#2): migrate local calendar date handling to Temporal.PlainDate.

// Date keys represent local calendar dates, not UTC instants.
export function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function* eachLocalDate(start: Date, end: Date): Generator<Date> {
  // Construct each local midnight afresh: a midnight DST jump must not carry
  // an hour offset into subsequent days and exclude the final date.
  for (
    let current = new Date(start);
    current <= end;
    current = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + 1,
    )
  ) {
    yield current;
  }
}
