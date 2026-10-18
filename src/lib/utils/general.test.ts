import { describe, expect, it } from "vitest";
import { formatTimeRange, hueFor } from "./general";

describe("time ranges", () => {
  const at = (local: string) =>
    Temporal.PlainDateTime.from(local).toZonedDateTime("Europe/Amsterdam")
      .epochMilliseconds;
  // Intl separates times with narrow and thin spaces.
  const format = (start: string, end: string) =>
    formatTimeRange(at(start), at(end), "Europe/Amsterdam", "en-US").replace(
      /\s+/g,
      " ",
    );

  it("names the day once for a span within it", () => {
    expect(format("2026-10-09T16:38", "2026-10-09T16:50")).toBe(
      "Friday, October 9, 2026, 16:38 – 16:50",
    );
  });

  it("names both days for a span across midnight", () => {
    expect(format("2026-10-08T23:50", "2026-10-09T00:10")).toBe(
      "Thursday, October 8, 2026 at 23:50 – Friday, October 9, 2026 at 00:10",
    );
  });

  it("shows a single time for a single moment", () => {
    expect(format("2026-10-09T16:38", "2026-10-09T16:38")).toBe(
      "Friday, October 9, 2026 at 16:38",
    );
  });
});

describe("hues", () => {
  it("returns the same hue on the color wheel for the same key", () => {
    for (const key of ["", "1", "site:github.com", "site:éxample.com"]) {
      const hue = hueFor(key);
      expect(hue).toBe(hueFor(key));
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it("spreads neighbouring numeric keys apart", () => {
    const hues = ["100", "101", "102"].map(hueFor);
    expect(new Set(hues).size).toBe(3);
    for (let i = 1; i < hues.length; i++) {
      const distance = Math.abs(hues[i] - hues[i - 1]);
      expect(Math.min(distance, 360 - distance)).toBeGreaterThan(30);
    }
  });
});
