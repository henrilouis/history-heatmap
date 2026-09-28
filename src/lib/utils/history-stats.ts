import { hierarchy, type HierarchyNode } from "d3-hierarchy";
import type { HistoryVisit } from "./chrome-api";

export type VisitTreeNode = {
  /** Unique across the whole tree, so a zoom target survives data updates. */
  id: string;
  name: string;
  kind: "root" | "site" | "page" | "other";
  /** Only set for pages. */
  url?: string;
  /** Visit count, including all descendants. */
  value: number;
  children?: VisitTreeNode[];
};

export type VisitTree = {
  root: VisitTreeNode;
  totalVisits: number;
  siteCount: number;
};

export type VisitTreeOptions = {
  /** Maximum rectangles per level; the smallest remainder is grouped. */
  maxSites?: number;
  maxPagesPerSite?: number;
};

const DEFAULT_MAX_SITES = 40;
const DEFAULT_MAX_PAGES_PER_SITE = 40;

/**
 * Groups a URL under the website it belongs to. Web pages group by host, so
 * ports stay distinct and "www." is merged with the bare domain. Other schemes
 * (chrome://, chrome-extension://, file://) keep their scheme to stay
 * recognisable and avoid colliding with web hosts.
 */
export function siteForUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    return parsed.host.replace(/^www\./, "");
  }
  if (parsed.protocol === "file:") return "Local files";
  return parsed.host ? `${parsed.protocol}//${parsed.host}` : parsed.protocol;
}

function pageName(url: string, title: string | undefined): string {
  if (title?.trim()) return title.trim();
  try {
    const { pathname, search } = new URL(url);
    return pathname + search || url;
  } catch {
    return url;
  }
}

function byValueThenName(a: VisitTreeNode, b: VisitTreeNode): number {
  return b.value - a.value || a.name.localeCompare(b.name);
}

function sumValues(nodes: VisitTreeNode[]): number {
  return nodes.reduce((sum, node) => sum + node.value, 0);
}

/**
 * Keeps at most `max` nodes: the largest ones, plus a single leaf summing the
 * rest. Tiny rectangles are unreadable, and thousands would slow rendering.
 */
function limitNodes(
  nodes: VisitTreeNode[],
  max: number,
  other: (count: number, value: number) => VisitTreeNode,
): VisitTreeNode[] {
  if (nodes.length <= max) return nodes;
  const kept = nodes.slice(0, Math.max(0, max - 1));
  const rest = nodes.slice(kept.length);
  return [...kept, other(rest.length, sumValues(rest))];
}

function plural(count: number, noun: string): string {
  return `${count.toLocaleString()} other ${noun}${count === 1 ? "" : "s"}`;
}

/** Builds a website → page hierarchy of visit counts for a treemap. */
export function buildVisitTree(
  visits: HistoryVisit[],
  {
    maxSites = DEFAULT_MAX_SITES,
    maxPagesPerSite = DEFAULT_MAX_PAGES_PER_SITE,
  }: VisitTreeOptions = {},
): VisitTree {
  // Count per URL first: visits share URL strings, so each URL parses once.
  const pages = new Map<string, { count: number; title?: string }>();
  for (const visit of visits) {
    const page = pages.get(visit.url);
    if (page) page.count++;
    else pages.set(visit.url, { count: 1, title: visit.title });
  }

  const sites = new Map<string, VisitTreeNode[]>();
  for (const [url, { count, title }] of pages) {
    const site = siteForUrl(url);
    let sitePages = sites.get(site);
    if (!sitePages) sites.set(site, (sitePages = []));
    sitePages.push({
      id: `page:${url}`,
      name: pageName(url, title),
      kind: "page",
      url,
      value: count,
    });
  }

  const siteNodes = [...sites].map(([site, sitePages]): VisitTreeNode => {
    sitePages.sort(byValueThenName);
    return {
      id: `site:${site}`,
      name: site,
      kind: "site",
      value: sumValues(sitePages),
      children: limitNodes(sitePages, maxPagesPerSite, (count, value) => ({
        id: `other:${site}`,
        name: plural(count, "page"),
        kind: "other",
        value,
      })),
    };
  });
  siteNodes.sort(byValueThenName);

  const children = limitNodes(siteNodes, maxSites, (count, value) => ({
    id: "other:sites",
    name: plural(count, "website"),
    kind: "other",
    value,
  }));

  return {
    root: {
      id: "root",
      name: "All websites",
      kind: "root",
      value: visits.length,
      children,
    },
    totalVisits: visits.length,
    siteCount: sites.size,
  };
}

/**
 * Converts the tree for d3 layouts, largest first. Only leaves contribute to
 * the sum: parents already carry their totals, which would double count.
 */
export function toVisitHierarchy(
  root: VisitTreeNode,
): HierarchyNode<VisitTreeNode> {
  return hierarchy(root)
    .sum((node) => (node.children ? 0 : node.value))
    .sort((a, b) => byValueThenName(a.data, b.data));
}
