import { describe, expect, it } from "vitest";
import { hueFor } from "./general";

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
