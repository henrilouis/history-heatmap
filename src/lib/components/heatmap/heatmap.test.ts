import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import Days from "./Days.svelte";
import Hours from "./Hours.svelte";
import { historyVisit } from "../../utils/history-fixtures";

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
