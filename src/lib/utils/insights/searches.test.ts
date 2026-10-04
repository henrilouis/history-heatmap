import { describe, expect, it } from "vitest";
import { aggregateVisits } from "./aggregate";
import { buildSearches, parseSearch } from "./searches";
import { localVisit, localVisits, TEST_TIME_ZONE } from "../history-fixtures";
import { siteForUrl } from "../history-stats";

describe("parseSearch", () => {
  it.each([
    ["https://www.google.com/search?q=svelte+runes", "Google", "svelte runes"],
    ["https://www.google.co.uk/search?q=Tea", "Google", "tea"],
    ["https://google.com.au/search?q=a", "Google", "a"],
    ["https://www.bing.com/search?q=%20Two%20%20words%20", "Bing", "two words"],
    ["https://duckduckgo.com/?q=privacy&ia=web", "DuckDuckGo", "privacy"],
    ["https://html.duckduckgo.com/html/?q=lite", "DuckDuckGo", "lite"],
    ["https://kagi.com/search?q=k", "Kagi", "k"],
    ["https://www.ecosia.org/search?q=trees", "Ecosia", "trees"],
    ["https://search.brave.com/search?q=lion", "Brave Search", "lion"],
    ["https://search.yahoo.com/search?p=yahoo", "Yahoo", "yahoo"],
    ["https://uk.search.yahoo.com/search?p=uk", "Yahoo", "uk"],
    ["https://www.youtube.com/results?search_query=lofi", "YouTube", "lofi"],
  ])("reads %s as a %s search for %j", (url, engine, term) => {
    expect(parseSearch(url, siteForUrl(url))).toEqual({ engine, term });
  });

  it.each([
    "https://www.google.com/maps?q=amsterdam",
    "https://www.google.com/search?q=%20%20",
    "https://www.google.com/search",
    "https://docs.google.com/search?q=doc",
    "https://notgoogle.com/search?q=fake",
    "https://example.com/search?q=other",
    "https://www.youtube.com/watch?v=abc",
  ])("ignores %s", (url) => {
    expect(parseSearch(url, siteForUrl(url))).toBe(undefined);
  });
});

describe("buildSearches", () => {
  it("counts visits per normalised term and per engine", () => {
    const aggregate = aggregateVisits(
      [
        ...localVisits(
          "https://www.google.com/search?q=Svelte&sca=1",
          "2026-03-01T10:00",
          2,
        ),
        ...localVisits(
          "https://www.google.com/search?q=svelte&sca=2",
          "2026-03-01T10:00",
          3,
        ),
        localVisit("https://duckduckgo.com/?q=svelte", "2026-03-01T10:00"),
        localVisit("https://duckduckgo.com/?q=temporal", "2026-03-01T10:00"),
        localVisit("https://example.com/?q=temporal", "2026-03-01T10:00"),
      ],
      TEST_TIME_ZONE,
    );

    expect(buildSearches(aggregate)).toEqual({
      total: 7,
      uniqueTerms: 2,
      terms: [
        {
          term: "svelte",
          count: 6,
          url: "https://www.google.com/search?q=svelte&sca=2",
        },
        {
          term: "temporal",
          count: 1,
          url: "https://duckduckgo.com/?q=temporal",
        },
      ],
      engines: [
        { name: "Google", count: 5 },
        { name: "DuckDuckGo", count: 2 },
      ],
    });
  });
});
