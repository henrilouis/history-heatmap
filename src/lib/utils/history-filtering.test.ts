import { describe, expect, it } from "vitest";
import { filterHistory } from "./chrome-api";
import { historyVisit } from "./history-fixtures";

describe("visit filtering with shared URL metadata", () => {
  const metadata = { url: "https://example.com/Cats", title: "Cat pictures" };
  const early = historyVisit("early", new Date(2026, 8, 10), metadata);
  const late = historyVisit("late", new Date(2026, 8, 12), metadata);
  const untitled = historyVisit("untitled", new Date(2026, 8, 11));
  const visits = [late, untitled, early];

  it.each(["CAT PICTURES", "cats"])("retains every matching visit for %s in input order", (query) => {
    expect(filterHistory(visits, query)).toEqual([late, early]);
    expect(visits).toEqual([late, untitled, early]);
  });

  it("matches URLs when titles are missing and resets correctly as the query changes", () => {
    expect(filterHistory(visits, "untitled")).toEqual([untitled]);
    expect(filterHistory(visits, "absent")).toEqual([]);
    expect(filterHistory(visits, "")).toBe(visits);
  });
});
