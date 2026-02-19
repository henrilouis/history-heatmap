export type CalendarMode = "day" | "hour";

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
  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, dateTimeFormatOptions);

  if (timestamp) {
    const dateStr = formatDate(new Date(timestamp));
    if (key.includes("T")) {
      const hour = key.split("T")[1];
      return `${dateStr} at ${hour}:00`;
    }
    return dateStr;
  }

  // Fallback to parsing the key
  if (key.includes("T")) {
    const [dateKey, hour] = key.split("T");
    return `${formatDate(new Date(dateKey))} at ${hour}:00`;
  }
  return formatDate(new Date(key));
}
