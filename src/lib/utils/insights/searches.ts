import type { VisitAggregate } from "./aggregate";

type Engine = {
  name: string;
  site: RegExp;
  paths: string[];
  param: string;
};

// Sites are hosts without "www.", as grouped by siteForUrl.
const ENGINES: Engine[] = [
  {
    name: "Google",
    site: /^google\.[a-z]{2,3}(\.[a-z]{2})?$/,
    paths: ["/search"],
    param: "q",
  },
  { name: "Bing", site: /^bing\.com$/, paths: ["/search"], param: "q" },
  {
    name: "DuckDuckGo",
    site: /^(html\.)?duckduckgo\.com$/,
    paths: ["/", "/html", "/html/"],
    param: "q",
  },
  { name: "Kagi", site: /^kagi\.com$/, paths: ["/search"], param: "q" },
  { name: "Ecosia", site: /^ecosia\.org$/, paths: ["/search"], param: "q" },
  {
    name: "Brave Search",
    site: /^search\.brave\.com$/,
    paths: ["/search"],
    param: "q",
  },
  {
    name: "Yahoo",
    site: /^([a-z]{2}\.)?search\.yahoo\.com$/,
    paths: ["/search"],
    param: "p",
  },
  {
    name: "YouTube",
    site: /^(m\.)?youtube\.com$/,
    paths: ["/results"],
    param: "search_query",
  },
];

export type SearchQuery = { engine: string; term: string };

/** Reads the search term from a search engine results URL. */
export function parseSearch(
  url: string,
  site: string,
): SearchQuery | undefined {
  const engine = ENGINES.find((candidate) => candidate.site.test(site));
  if (!engine) return;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (!engine.paths.includes(parsed.pathname)) return;
  const term = parsed.searchParams
    .get(engine.param)
    ?.trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
  return term ? { engine: engine.name, term } : undefined;
}

export type SearchTerm = {
  term: string;
  count: number;
  /** The most visited results page, to search again. */
  url: string;
};

export type Searches = {
  total: number;
  uniqueTerms: number;
  terms: SearchTerm[];
  engines: { name: string; count: number }[];
};

const TERM_LIMIT = 10;

/** Counts every visit to a results page, as the rest of the stats do. */
export function buildSearches({ urls }: VisitAggregate): Searches {
  const terms = new Map<string, SearchTerm & { urlVisits: number }>();
  const engines = new Map<string, number>();
  let total = 0;

  for (const page of urls.values()) {
    const search = parseSearch(page.url, page.site);
    if (!search) continue;
    total += page.visits;
    engines.set(search.engine, (engines.get(search.engine) ?? 0) + page.visits);
    const entry = terms.get(search.term);
    if (!entry) {
      terms.set(search.term, {
        term: search.term,
        count: page.visits,
        url: page.url,
        urlVisits: page.visits,
      });
      continue;
    }
    entry.count += page.visits;
    if (page.visits > entry.urlVisits) {
      entry.url = page.url;
      entry.urlVisits = page.visits;
    }
  }

  return {
    total,
    uniqueTerms: terms.size,
    terms: [...terms.values()]
      .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
      .slice(0, TERM_LIMIT)
      .map(({ term, count, url }) => ({ term, count, url })),
    engines: [...engines]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}
