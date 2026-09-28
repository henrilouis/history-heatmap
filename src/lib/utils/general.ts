import { toLocalZonedDateTime } from "./date";

export type CalendarMode = "days" | "hours";
export type ViewMode = CalendarMode | "stats";

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

/**
 * A stable hue in degrees for a key, so the same trail or website keeps its
 * colour across renders and sessions.
 */
export function hueFor(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  // Spread similar keys, such as neighbouring numeric visit IDs, around the
  // colour wheel.
  return ((((hash % 360) * 137.508) % 360) + 360) % 360;
}
