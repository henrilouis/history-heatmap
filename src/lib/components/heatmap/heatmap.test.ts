import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import Days from "./Days.svelte";
import Hours from "./Hours.svelte";

const selection = { selectedMoments: [], onToggleMoment: () => {} };

describe("calendar date rendering", () => {
  it("places a Saturday date key in the Saturday row", () => {
    const { body } = render(Days, {
      props: { ...selection, data: { "2026-09-12": [{ id: "visit" }] } },
    });
    const tbody = body.match(/<tbody>([\s\S]*?)<\/tbody>/)![1];
    const rows = [...tbody.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((match) => match[1]);

    expect(rows).toHaveLength(7);
    expect(rows[5]).toContain('data-date="2026-09-12"');
    expect(rows[4]).not.toContain('data-date="2026-09-12"');
  });

  it("labels a Monday on the first of the month with its local month", () => {
    const { body } = render(Days, {
      props: { ...selection, data: { "2027-03-01": [{ id: "visit" }] } },
    });
    const month = new Date(2027, 2, 1).toLocaleString("default", { month: "short" });

    expect(body).toContain(`<th colspan="1">${month}</th>`);
  });

  it("uses the local day number and month in hour-view headers", () => {
    const { body } = render(Hours, {
      props: { ...selection, data: { "2027-03-01": { "09": [{ id: "visit" }] } } },
    });
    const month = new Date(2027, 2, 1).toLocaleDateString(undefined, { month: "short" });

    expect(body).toContain('<th title="2027-03-01">1</th>');
    expect(body).toContain(`<th colspan="1">${month}</th>`);
  });
});
