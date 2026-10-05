import { describe, expect, it } from "vitest";
import { formatHash, parseHash } from "./route";

describe("hash routes", () => {
  it.each([
    { hash: "", view: "days", search: "" },
    { hash: "#", view: "days", search: "" },
    { hash: "#/", view: "days", search: "" },
    { hash: "#/days", view: "days", search: "" },
    { hash: "#/hours", view: "hours", search: "" },
    { hash: "#/stats", view: "stats", search: "" },
    { hash: "#stats/", view: "stats", search: "" },
    { hash: "#/unknown", view: "days", search: "" },
    { hash: "#/Stats", view: "days", search: "" },
    { hash: "#/stats/extra", view: "days", search: "" },
    { hash: "#/hours?q=github", view: "hours", search: "github" },
    { hash: "#/unknown?q=github", view: "days", search: "github" },
    { hash: "#?q=github", view: "days", search: "github" },
    { hash: "#/stats?q=", view: "stats", search: "" },
    { hash: "#/stats?other=1", view: "stats", search: "" },
    { hash: "#/stats?q=a%20b%26c", view: "stats", search: "a b&c" },
    { hash: "#/stats?q=a+b", view: "stats", search: "a b" },
  ])("parses '$hash' as $view", ({ hash, view, search }) => {
    expect(parseHash(hash)).toEqual({ view, search });
  });

  it("omits an empty search", () => {
    expect(formatHash({ view: "stats", search: "" })).toBe("#/stats");
    expect(formatHash({ view: "days", search: "" })).toBe("#/days");
  });

  it.each([
    "github",
    "two words",
    "a&q=b",
    "hash#tag",
    "what?",
    "100%",
    "ünïcödé",
  ])("round-trips the search '%s'", (search) => {
    const hash = formatHash({ view: "hours", search });
    // The query must not leak a second fragment or query separator.
    expect(hash.slice(1)).not.toContain("#");
    expect(hash.indexOf("?")).toBe(hash.lastIndexOf("?"));
    expect(parseHash(hash)).toEqual({ view: "hours", search });
  });
});
