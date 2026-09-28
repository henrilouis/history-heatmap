import { describe, expect, it } from "vitest";
import {
  buildVisitTree,
  siteForUrl,
  toVisitHierarchy,
  type VisitTreeNode,
} from "./history-stats";
import { historyVisit } from "./history-fixtures";

function visits(url: string, count: number, title?: string) {
  return Array.from({ length: count }, (_, i) =>
    historyVisit(`${url}#${i}`, undefined, { url, title }),
  );
}

function summary(node: VisitTreeNode): unknown {
  return node.children
    ? [node.name, node.value, node.children.map(summary)]
    : [node.name, node.value];
}

describe("siteForUrl", () => {
  it.each([
    ["https://www.example.com/a?b=c", "example.com"],
    ["http://example.com", "example.com"],
    ["https://docs.example.com/", "docs.example.com"],
    ["http://localhost:5173/", "localhost:5173"],
    ["chrome://settings/privacy", "chrome://settings"],
    ["chrome-extension://abc/index.html", "chrome-extension://abc"],
    ["file:///Users/me/notes.txt", "Local files"],
    ["about:blank", "about:"],
    ["not a url", "not a url"],
  ])("groups %s under %s", (url, site) => {
    expect(siteForUrl(url)).toBe(site);
  });
});

describe("buildVisitTree", () => {
  it("counts every visit per page and groups pages by site, largest first", () => {
    const tree = buildVisitTree([
      ...visits("https://a.com/one", 1, "One"),
      ...visits("https://www.b.com/", 4, "B home"),
      ...visits("https://a.com/two", 2),
      ...visits("https://b.com/x?y=1", 1),
    ]);

    expect(tree.totalVisits).toBe(8);
    expect(tree.siteCount).toBe(2);
    expect(summary(tree.root)).toEqual([
      "All websites",
      8,
      [
        [
          "b.com",
          5,
          [
            ["B home", 4],
            ["/x?y=1", 1],
          ],
        ],
        [
          "a.com",
          3,
          [
            ["/two", 2],
            ["One", 1],
          ],
        ],
      ],
    ]);
    expect(tree.root.children![0].children![0]).toMatchObject({
      id: "page:https://www.b.com/",
      kind: "page",
      url: "https://www.b.com/",
    });
  });

  it("groups the smallest sites and pages beyond the limits into one leaf", () => {
    const tree = buildVisitTree(
      [
        ...visits("https://a.com/1", 5),
        ...visits("https://a.com/2", 4),
        ...visits("https://a.com/3", 3),
        ...visits("https://b.com/", 2),
        ...visits("https://c.com/", 1),
        ...visits("https://d.com/", 1),
      ],
      { maxSites: 2, maxPagesPerSite: 2 },
    );

    expect(tree.siteCount).toBe(4);
    expect(summary(tree.root)).toEqual([
      "All websites",
      16,
      [
        [
          "a.com",
          12,
          [
            ["/1", 5],
            ["2 other pages", 7],
          ],
        ],
        ["3 other websites", 4],
      ],
    ]);
    expect(tree.root.children!.map((node) => node.id)).toEqual([
      "site:a.com",
      "other:sites",
    ]);
  });

  it("keeps everything when exactly at the limit", () => {
    const tree = buildVisitTree(
      [...visits("https://a.com/", 2), ...visits("https://b.com/", 1)],
      { maxSites: 2 },
    );
    expect(tree.root.children!.map((node) => node.name)).toEqual([
      "a.com",
      "b.com",
    ]);
  });

  it("returns an empty root without visits", () => {
    const tree = buildVisitTree([]);
    expect(tree).toMatchObject({ totalVisits: 0, siteCount: 0 });
    expect(tree.root.children).toEqual([]);
  });
});

describe("toVisitHierarchy", () => {
  it("sums leaves without double counting parent totals", () => {
    const root = toVisitHierarchy(
      buildVisitTree([
        ...visits("https://a.com/1", 1),
        ...visits("https://b.com/1", 2),
        ...visits("https://b.com/2", 1),
      ]).root,
    );

    expect(root.value).toBe(4);
    expect(root.children!.map((node) => [node.data.name, node.value])).toEqual([
      ["b.com", 3],
      ["a.com", 1],
    ]);
  });
});
