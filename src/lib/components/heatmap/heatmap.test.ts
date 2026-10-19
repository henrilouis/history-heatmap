import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import Days from "./Days.svelte";
import Hours from "./Hours.svelte";
import { historyVisit } from "../../utils/history-fixtures";
import { placeholderDays, placeholderHours } from "../../utils/chrome-api";

const selection = { selectedMoments: [], onToggleMoment: () => {} };

// Check rendered header text without depending on attributes or inline wrappers.
function headerTexts(html: string): string[] {
  return [...html.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(([, content]) =>
    content.replace(/<!--[\s\S]*?-->|<[^>]+>/g, "").trim(),
  );
}

describe("calendar date rendering", () => {
  it("places a Saturday date key in the Saturday row", () => {
    const { body } = render(Days, {
      props: { ...selection, data: { "2026-09-12": [historyVisit("visit")] } },
    });
    const rowsWithVisit = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)]
      .map(([, row]) => row)
      .filter((row) => row.includes('data-date="2026-09-12"'));
    const saturday = new Date(2026, 8, 12).toLocaleDateString(undefined, {
      weekday: "short",
    });

    expect(
      rowsWithVisit,
      "the visit should appear in exactly one calendar row",
    ).toHaveLength(1);
    expect(headerTexts(rowsWithVisit[0])).toContain(saturday);
  });

  it("labels a Monday on the first of the month with its local month", () => {
    const { body } = render(Days, {
      props: { ...selection, data: { "2027-03-01": [historyVisit("visit")] } },
    });
    const month = new Date(2027, 2, 1).toLocaleString("default", {
      month: "short",
    });

    expect(headerTexts(body)).toContain(month);
  });

  it("uses the local day number and month in hour-view headers", () => {
    const { body } = render(Hours, {
      props: {
        ...selection,
        data: { "2027-03-01": { "09": [historyVisit("visit")] } },
      },
    });
    const month = new Date(2027, 2, 1).toLocaleDateString(undefined, {
      month: "short",
    });

    expect(headerTexts(body)).toContain("1");
    expect(headerTexts(body)).toContain(month);
  });
});

describe.each([
  { name: "Days", component: Days, data: placeholderDays(), rows: 7 },
  { name: "Hours", component: Hours, data: placeholderHours(), rows: 24 },
] as const)("$name loading state", ({ component, data, rows }) => {
  it("draws an inert calendar with a wave position on every cell", () => {
    const { body } = render(component as typeof Days, {
      props: { ...selection, data: data as never, loading: true },
    });
    const bodyRows = body.match(/<tbody\b[\s\S]*<\/tbody>/)![0];
    const cells = bodyRows.match(/<button\b[^>]*>/g)!;

    expect(body).toMatch(/class="heatmap loading[^"]*"[^>]*aria-busy="true"/);
    expect(body).toMatch(/<div\b[^>]*\binert\b/);
    expect(bodyRows.match(/<tr\b/g)).toHaveLength(rows);
    expect(cells.length).toBeGreaterThan(rows);
    expect(cells.every((cell) => /--wave:\s*[\d.]+/.test(cell))).toBe(true);
  });

  it("shows an empty message instead of a calendar without data", () => {
    const { body } = render(component as typeof Days, {
      props: { ...selection, data: {} },
    });

    expect(body).toContain("No history data available");
    expect(body).not.toContain("<table");
  });

  it("does not mark loaded calendars as loading", () => {
    const { body } = render(component as typeof Days, {
      props: { ...selection, data: data as never },
    });

    expect(body).not.toContain("loading");
    expect(body).not.toMatch(/\binert\b/);
  });
});
