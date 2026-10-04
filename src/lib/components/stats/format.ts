import { toLocalZonedDateTime } from "../../utils/date";
import { fromDayNumber } from "../../utils/insights/aggregate";

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

/** Averages keep a decimal while small, where it still means something. */
export function formatAverage(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value < 10 ? 1 : 0,
  });
}

export function averageVisits(value: number): string {
  return `${formatAverage(value)} ${value === 1 ? "visit" : "visits"} on average`;
}

export function formatPercent(share: number): string {
  return share.toLocaleString(undefined, {
    style: "percent",
    maximumFractionDigits: 0,
  });
}

export function formatHour(hour: number): string {
  return `${String(hour % 24).padStart(2, "0")}:00`;
}

export function formatDay(
  day: number,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  },
): string {
  return fromDayNumber(day).toLocaleString(undefined, options);
}

export function formatTimestamp(
  timestamp: number,
  options: Intl.DateTimeFormatOptions,
): string {
  return toLocalZonedDateTime(timestamp)
    .toPlainDate()
    .toLocaleString(undefined, options);
}

// Day 4 since 1970-01-01 is Monday 5 January 1970.
const FIRST_MONDAY = 4;

/** 0 is Monday. */
export function formatWeekday(
  weekday: number,
  style: "long" | "short" | "narrow" = "long",
): string {
  return formatDay(FIRST_MONDAY + weekday, { weekday: style });
}

export function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}

export function formatDuration(milliseconds: number): string {
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return plural(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest
    ? `${plural(hours, "hour")} and ${plural(rest, "minute")}`
    : plural(hours, "hour");
}
