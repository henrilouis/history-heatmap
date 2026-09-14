import { toLocalZonedDateTime } from "./date";

export type CalendarMode = "days" | "hours";

export const dateTimeFormatOptions: Intl.DateTimeFormatOptions = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
};

/**
 * Format a moment key for display.
 * Handles both day keys ("2024-01-15") and hour keys ("2024-01-15T14").
 * Optionally uses a timestamp for more accurate date display.
 */
export function formatMomentKey(key: string, timestamp?: number): string {
  const [dateKey, hour] = key.split("T");
  const date =
    timestamp !== undefined
      ? toLocalZonedDateTime(timestamp).toPlainDate()
      : Temporal.PlainDate.from(dateKey);
  const label = date.toLocaleString(undefined, dateTimeFormatOptions);
  return hour === undefined ? label : `${label} at ${hour}:00`;
}
